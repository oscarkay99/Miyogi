-- dailyCapacity = 0 now means "no overall daily limit" (each window's own meal limit still applies).

create or replace function public.place_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ord jsonb; pay jsonb;
  v_now timestamptz := now();
  v_today date := (now() at time zone 'Africa/Accra')::date;
  v_date date; v_wd int; v_cutoff timestamptz; v_win jsonb; v_area text;
  v_phone text; cl jsonb; it public.menu_items%rowtype; g jsonb; o jsonb; picked int;
  opts jsonb; unit int; lines jsonb := '[]'; subtotal int := 0; meals int := 0;
  fee int; disc int := 0; total int; cp public.coupons%rowtype; eligible int; redemptions int; prior int;
  slot_used int; day_used int; remaining int; want int; used int; seq int; day_key text;
  ref text; tok text; method text; awaiting boolean; email text;
begin
  perform public.sweep_expired_holds();
  ord := (select value from public.site_settings where key = 'ordering');
  pay := (select value from public.site_settings where key = 'payments');

  if length(trim(coalesce(p->>'name',''))) < 2 then return public.fail('Please enter your full name.', 'name'); end if;
  v_phone := public.normalize_gh_phone(p->>'phone');
  if v_phone is null then return public.fail('Enter a valid Ghana phone number, e.g. 054 755 7772.', 'phone'); end if;
  email := trim(coalesce(p->>'email',''));
  if email <> '' and email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return public.fail('Enter a valid email or leave it blank.', 'email'); end if;
  if length(trim(coalesce(p->>'address',''))) < 5 then return public.fail('Enter your delivery address.', 'address'); end if;
  if jsonb_typeof(p->'lines') <> 'array' or jsonb_array_length(p->'lines') = 0 or jsonb_array_length(p->'lines') > 20 then
    return public.fail('Your cart is empty.'); end if;

  begin v_date := (p->>'date')::date; exception when others then return public.fail('Choose a delivery date.', 'date'); end;
  perform pg_advisory_xact_lock(hashtext('slots:' || v_date::text));

  if coalesce((ord->>'open')::boolean, false) is not true then return public.fail('Pre-orders are not open right now.'); end if;
  v_wd := extract(dow from v_date)::int;
  if v_date < v_today or v_date > v_today + (ord->>'maxHorizonDays')::int
     or (ord->'blackoutDates') ? v_date::text
     or not exists (select 1 from jsonb_array_elements_text(ord->'deliveryWeekdays') w where w::int = v_wd) then
    return public.fail('That delivery date is no longer open for orders.', 'date'); end if;
  v_cutoff := ((v_date - (ord->>'cutoffDaysBefore')::int) + (ord->>'cutoffTime')::time)::timestamp at time zone 'Africa/Accra';
  if v_now >= v_cutoff then return public.fail('Ordering for that day has closed.', 'date'); end if;

  select w into v_win from jsonb_array_elements(ord->'windows') w where w->>'id' = p->>'windowId';
  if v_win is null then return public.fail('Choose a delivery time window.', 'windowId'); end if;
  if ((v_date + (v_win->>'start')::time)::timestamp at time zone 'Africa/Accra') < v_now + ((ord->>'minNoticeHours')::int * interval '1 hour') then
    return public.fail('That time window is too soon to prepare.', 'windowId'); end if;

  v_area := left(trim(coalesce(p->>'area', '')), 120);
  if length(v_area) < 2 then return public.fail('Enter your delivery area.', 'area'); end if;

  method := p->>'paymentMethod';
  if not ((method = 'manual' and coalesce((pay->'manual'->>'enabled')::boolean, false))
       or (method = 'cod' and coalesce((pay->'cod'->>'enabled')::boolean, false))) then
    return public.fail('That payment method is not available.'); end if;

  -- price every line from the catalogue; never from the browser
  for cl in select * from jsonb_array_elements(p->'lines') loop
    select * into it from public.menu_items where id = cl->>'itemId' and active;
    if not found then return public.fail('An item in your cart is no longer available.'); end if;
    if (cl->>'quantity') !~ '^[0-9]+$' or (cl->>'quantity')::int < 1 or (cl->>'quantity')::int > 50 then
      return public.fail('Invalid quantity for ' || it.name || '.'); end if;
    opts := '[]'; unit := it.price;
    for g in select * from jsonb_array_elements(it.option_groups) loop
      picked := 0;
      for o in select * from jsonb_array_elements(g->'options') loop
        if coalesce(cl->'optionIds', '[]'::jsonb) ? (o->>'id') then
          picked := picked + 1; unit := unit + (o->>'priceDelta')::int;
          opts := opts || jsonb_build_object('groupName', g->>'name', 'name', o->>'name', 'priceDelta', (o->>'priceDelta')::int);
        end if;
      end loop;
      if coalesce((g->>'required')::boolean, false) and picked = 0 then return public.fail('Please choose: ' || (g->>'name') || '.'); end if;
      if not coalesce((g->>'multiple')::boolean, false) and picked > 1 then return public.fail('Only one choice allowed for ' || (g->>'name') || '.'); end if;
      if g ? 'maxSelect' and picked > (g->>'maxSelect')::int then return public.fail('Too many choices for ' || (g->>'name') || '.'); end if;
    end loop;
    if exists (select 1 from jsonb_array_elements_text(coalesce(cl->'optionIds', '[]'::jsonb)) x(id)
               where not exists (select 1 from jsonb_array_elements(it.option_groups) gg, jsonb_array_elements(gg->'options') oo where oo->>'id' = x.id)) then
      return public.fail('An option on ' || it.name || ' is no longer available.'); end if;

    if cardinality(it.available_weekdays) > 0 and not (v_wd = any(it.available_weekdays)) then
      return public.fail(it.name || ' is not available on the chosen date.'); end if;
    if it.daily_limit is not null then
      select coalesce(sum((l->>'quantity')::int), 0) into used from public.capacity_orders o2 cross join lateral jsonb_array_elements(o2.lines) l
        where o2.delivery_date = v_date and l->>'itemId' = it.id;
      select coalesce(sum((x->>'quantity')::int), 0) into want from jsonb_array_elements(p->'lines') x where x->>'itemId' = it.id;
      if used + want > it.daily_limit then return public.fail(it.name || ' is fully booked for that date.'); end if;
    end if;

    lines := lines || jsonb_build_object('itemId', it.id, 'name', it.name, 'unitPrice', unit, 'quantity', (cl->>'quantity')::int,
      'options', opts, 'note', left(coalesce(cl->>'note',''), 300), 'lineTotal', unit * (cl->>'quantity')::int);
    subtotal := subtotal + unit * (cl->>'quantity')::int;
    meals := meals + (cl->>'quantity')::int;
  end loop;

  -- capacity (serialised per delivery date by the advisory lock above)
  select coalesce(sum((l->>'quantity')::int), 0) into slot_used from public.capacity_orders o2 cross join lateral jsonb_array_elements(o2.lines) l
    where o2.delivery_date = v_date and o2.window_id = v_win->>'id';
  select coalesce(sum((l->>'quantity')::int), 0) into day_used from public.capacity_orders o2 cross join lateral jsonb_array_elements(o2.lines) l
    where o2.delivery_date = v_date;
  remaining := (v_win->>'capacity')::int - slot_used;
  -- dailyCapacity 0 / missing means no overall daily limit: only the window's own limit applies
  if coalesce((ord->>'dailyCapacity')::int, 0) > 0 then remaining := least(remaining, (ord->>'dailyCapacity')::int - day_used); end if;
  remaining := greatest(0, remaining);
  if remaining <= 0 then return public.fail('That time window is full.', 'windowId'); end if;
  if meals > remaining then return public.fail('Only ' || remaining || ' meal(s) left in that window. Reduce your quantity or choose another window.'); end if;

  fee := coalesce((select (value->>'deliveryFee')::int from public.site_settings where key = 'services'), 0);

  if trim(coalesce(p->>'couponCode','')) <> '' then
    select * into cp from public.coupons where lower(code) = lower(trim(p->>'couponCode'));
    if not found then return public.fail('That promo code is not valid.'); end if;
    select count(*) into redemptions from public.orders where coupon_code = cp.code and status not in ('cancelled','payment_failed','rejected');
    select count(*) into prior from public.orders where customer_phone = v_phone and status not in ('cancelled','payment_failed','rejected');
    if not cp.active then return public.fail('This code is not active.'); end if;
    if cp.expires_at is not null and v_today > cp.expires_at then return public.fail('This code has expired.'); end if;
    if cp.usage_limit is not null and redemptions >= cp.usage_limit then return public.fail('This code has reached its usage limit.'); end if;
    if cp.first_order_only and prior > 0 then return public.fail('This code is for first orders only.'); end if;
    if subtotal < cp.min_subtotal then return public.fail('Your basket is below the minimum for this code.'); end if;
    if cardinality(cp.item_ids) > 0 then
      select coalesce(sum((l->>'lineTotal')::int), 0) into eligible from jsonb_array_elements(lines) l where l->>'itemId' = any(cp.item_ids);
      if eligible = 0 then return public.fail('This code does not apply to the items in your basket.'); end if;
    else eligible := subtotal; end if;
    disc := case cp.type when 'percent' then round(eligible * least(100, cp.value) / 100.0)::int
                         when 'fixed' then least(eligible, cp.value) else fee end;
  end if;
  total := subtotal + fee - disc;

  day_key := to_char(v_today, 'YYYYMMDD');
  insert into public.order_seq as s (day, last) values (day_key, 1)
    on conflict (day) do update set last = s.last + 1 returning last into seq;
  ref := 'RNS-' || day_key || '-' || lpad(seq::text, 4, '0');
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  awaiting := method = 'manual';

  insert into public.orders (reference, tracking_token, status, payment_status, payment_method, hold_expires_at, lines,
    subtotal, delivery_fee, discount, total, coupon_code, customer_name, customer_phone, customer_email,
    zone_id, zone_name, address, landmark, instructions, delivery_date, window_id, window_label, notes, events, consent_whatsapp)
  values (ref, tok, case when awaiting then 'awaiting_payment' else 'awaiting_acceptance' end,
    case when awaiting then 'pending_verification' else 'unpaid' end, method,
    case when awaiting then v_now + ((ord->>'holdMinutes')::int * interval '1 minute') end, lines,
    subtotal, fee, disc, total, case when cp.id is not null then cp.code end, trim(p->>'name'), v_phone, email,
    'typed', v_area, trim(p->>'address'), left(trim(coalesce(p->>'landmark','')), 120), left(trim(coalesce(p->>'instructions','')), 300),
    v_date, v_win->>'id', v_win->>'label', left(trim(coalesce(p->>'notes','')), 300),
    jsonb_build_array(jsonb_build_object('at', v_now, 'status', case when awaiting then 'awaiting_payment' else 'awaiting_acceptance' end, 'note', 'Order placed', 'by', 'customer')),
    coalesce((p->>'consentWhatsApp')::boolean, false));

  return jsonb_build_object('ok', true, 'token', tok, 'reference', ref);
end $$;

revoke all on function public.place_order(jsonb) from public, anon, authenticated;
grant execute on function public.place_order(jsonb) to anon, authenticated;
