-- Rice and Spice: core schema, row-level security and order functions.
-- Money is integer pesewas. Business time is Africa/Accra (UTC+0, no DST).

create table public.staff (
  user_id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('owner','manager','kitchen','delivery')),
  created_at timestamptz not null default now()
);

create or replace function public.staff_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.staff where user_id = auth.uid() $$;

create or replace function public.is_staff(roles text[] default null) returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.staff_role() = any(coalesce(roles, array['owner','manager','kitchen','delivery'])), false) $$;

create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
create table public.categories (
  id text primary key, name text not null, sort_order int not null default 0, active boolean not null default true
);
create table public.menu_items (
  id text primary key,
  slug text not null unique,
  name text not null,
  description text not null default '',
  category_id text not null references public.categories(id),
  price int not null check (price >= 0),
  images text[] not null default '{}',
  active boolean not null default false,
  featured boolean not null default false,
  sort_order int not null default 99,
  available_weekdays int[] not null default '{}',
  daily_limit int check (daily_limit is null or daily_limit >= 0),
  allergens text not null default '',
  dietary text not null default '',
  option_groups jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.delivery_zones (
  id text primary key, name text not null, neighbourhoods text not null default '',
  fee int not null default 0 check (fee >= 0), min_order int not null default 0 check (min_order >= 0),
  active boolean not null default true
);
create table public.coupons (
  id text primary key,
  code text not null,
  type text not null check (type in ('percent','fixed','free_delivery')),
  value int not null default 0 check (value >= 0),
  min_subtotal int not null default 0,
  active boolean not null default false,
  expires_at date,
  usage_limit int,
  first_order_only boolean not null default false,
  item_ids text[] not null default '{}'
);
create unique index coupons_code_lower on public.coupons (lower(code));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  tracking_token text not null unique,
  created_at timestamptz not null default now(),
  status text not null check (status in ('awaiting_payment','payment_confirmed','awaiting_acceptance','accepted','preparing','ready','out_for_delivery','delivered','cancelled','rejected','payment_failed','refunded','partially_refunded')),
  payment_status text not null check (payment_status in ('unpaid','pending_verification','paid','failed','refunded','partially_refunded')),
  payment_method text not null check (payment_method in ('manual','cod','momo','card')),
  hold_expires_at timestamptz,
  lines jsonb not null,
  subtotal int not null, delivery_fee int not null, discount int not null default 0, total int not null,
  coupon_code text,
  customer_name text not null, customer_phone text not null, customer_email text not null default '',
  zone_id text not null, zone_name text not null,
  address text not null, landmark text not null default '', instructions text not null default '',
  delivery_date date not null, window_id text not null, window_label text not null,
  notes text not null default '',
  internal_notes jsonb not null default '[]',
  refunds jsonb not null default '[]',
  refund_due boolean not null default false,
  rider jsonb,
  events jsonb not null default '[]',
  consent_whatsapp boolean not null default false
);
create index orders_slot on public.orders (delivery_date, window_id);
create index orders_phone on public.orders (customer_phone);
create index orders_status on public.orders (status);
create index orders_created on public.orders (created_at desc);

create table public.order_seq (day text primary key, last int not null);
create table public.order_transitions (from_status text, to_status text, primary key (from_status, to_status));
insert into public.order_transitions values
 ('awaiting_payment','payment_confirmed'),('awaiting_payment','payment_failed'),('awaiting_payment','cancelled'),
 ('payment_confirmed','awaiting_acceptance'),
 ('awaiting_acceptance','accepted'),('awaiting_acceptance','rejected'),('awaiting_acceptance','cancelled'),
 ('accepted','preparing'),('accepted','cancelled'),
 ('preparing','ready'),('preparing','cancelled'),
 ('ready','out_for_delivery'),('ready','cancelled'),
 ('out_for_delivery','delivered'),('out_for_delivery','ready'),('out_for_delivery','cancelled'),
 ('delivered','refunded'),('delivered','partially_refunded'),
 ('cancelled','refunded'),('rejected','refunded'),
 ('payment_failed','awaiting_payment'),('partially_refunded','refunded');

create table public.audit_logs (
  id bigserial primary key, at timestamptz not null default now(),
  actor uuid, action text not null, detail text not null default ''
);

-- ---------- row level security ----------
alter table public.staff enable row level security;
alter table public.site_settings enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_seq enable row level security;
alter table public.order_transitions enable row level security;
alter table public.audit_logs enable row level security;

create policy staff_self on public.staff for select to authenticated using (user_id = auth.uid());

create policy settings_read on public.site_settings for select to anon, authenticated using (true);
create policy settings_write on public.site_settings for all to authenticated using (public.is_staff(array['owner','manager'])) with check (public.is_staff(array['owner','manager']));

create policy cat_read on public.categories for select to anon, authenticated using (active or public.is_staff());
create policy cat_write on public.categories for all to authenticated using (public.is_staff(array['owner','manager'])) with check (public.is_staff(array['owner','manager']));

create policy item_read on public.menu_items for select to anon, authenticated using (active or public.is_staff());
create policy item_write on public.menu_items for all to authenticated using (public.is_staff(array['owner','manager'])) with check (public.is_staff(array['owner','manager']));

create policy zone_read on public.delivery_zones for select to anon, authenticated using (active or public.is_staff());
create policy zone_write on public.delivery_zones for all to authenticated using (public.is_staff(array['owner','manager'])) with check (public.is_staff(array['owner','manager']));

-- coupon codes are never readable by the public; checkout validates them server-side
create policy coupon_staff on public.coupons for all to authenticated using (public.is_staff(array['owner','manager'])) with check (public.is_staff(array['owner','manager']));

-- orders: staff may read; ALL writes go through the security-definer functions below
create policy orders_staff_read on public.orders for select to authenticated using (public.is_staff());
create policy audit_read on public.audit_logs for select to authenticated using (public.is_staff(array['owner','manager']));

-- ---------- helpers ----------
create or replace function public.normalize_gh_phone(p text) returns text
language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p,''), '[\s\-().]', '', 'g');
begin
  if left(d,1) = '+' then d := substr(d,2); end if;
  if left(d,2) = '00' then d := substr(d,3); end if;
  if left(d,3) = '233' then d := substr(d,4); elsif left(d,1) = '0' then d := substr(d,2); end if;
  if d !~ '^[0-9]{9}$' then return null; end if;
  if left(d,2) not in ('24','25','53','54','55','59','20','50','26','27','56','57','23','28','29') then return null; end if;
  return '+233' || d;
end $$;

create or replace function public.fail(msg text, field text default null) returns jsonb
language sql immutable as $$
  select jsonb_build_object('ok', false, 'errors', jsonb_build_array(msg),
    'fieldErrors', case when field is null then '{}'::jsonb else jsonb_build_object(field, msg) end) $$;

-- orders that currently hold kitchen capacity (unpaid holds expire)
create or replace view public.capacity_orders as
  select * from public.orders
  where status in ('awaiting_payment','payment_confirmed','awaiting_acceptance','accepted','preparing','ready','out_for_delivery','delivered')
    and not (status = 'awaiting_payment' and hold_expires_at <= now());
revoke all on public.capacity_orders from anon, authenticated;

create or replace function public.sweep_expired_holds() returns void
language sql security definer set search_path = public as $$
  update public.orders set status = 'cancelled', payment_status = 'failed',
    events = events || jsonb_build_object('at', now(), 'status', 'cancelled', 'note', 'Payment hold expired', 'by', 'system')
  where status = 'awaiting_payment' and hold_expires_at <= now() $$;

-- meals already booked per date/window: no personal data, safe for the public
create or replace function public.capacity_load(p_from date, p_to date)
returns table(delivery_date date, window_id text, meals int)
language sql stable security definer set search_path = public as $$
  select o.delivery_date, o.window_id, coalesce(sum((l->>'quantity')::int), 0)::int
  from public.capacity_orders o cross join lateral jsonb_array_elements(o.lines) l
  where o.delivery_date between p_from and p_to
  group by 1, 2 $$;

create or replace function public.item_load(p_item text, p_from date, p_to date)
returns table(delivery_date date, meals int)
language sql stable security definer set search_path = public as $$
  select o.delivery_date, coalesce(sum((l->>'quantity')::int), 0)::int
  from public.capacity_orders o cross join lateral jsonb_array_elements(o.lines) l
  where o.delivery_date between p_from and p_to and l->>'itemId' = p_item
  group by 1 $$;

-- ---------- placing an order (authoritative pricing, scheduling and capacity) ----------
create or replace function public.place_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ord jsonb; pay jsonb;
  v_now timestamptz := now();
  v_today date := (now() at time zone 'Africa/Accra')::date;
  v_date date; v_wd int; v_cutoff timestamptz; v_win jsonb; v_zone public.delivery_zones%rowtype;
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

  select * into v_zone from public.delivery_zones where id = p->>'zoneId' and active;
  if not found then return public.fail('Sorry, we do not deliver to that area yet.', 'zoneId'); end if;

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
  remaining := greatest(0, least((v_win->>'capacity')::int - slot_used, (ord->>'dailyCapacity')::int - day_used));
  if remaining <= 0 then return public.fail('That time window is full.', 'windowId'); end if;
  if meals > remaining then return public.fail('Only ' || remaining || ' meal(s) left in that window. Reduce your quantity or choose another window.'); end if;

  if subtotal < v_zone.min_order then return public.fail('The minimum order for ' || v_zone.name || ' is GHS ' || (v_zone.min_order / 100.0)::numeric(10,2) || '.'); end if;
  fee := v_zone.fee;

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
    v_zone.id, v_zone.name, trim(p->>'address'), left(trim(coalesce(p->>'landmark','')), 120), left(trim(coalesce(p->>'instructions','')), 300),
    v_date, v_win->>'id', v_win->>'label', left(trim(coalesce(p->>'notes','')), 300),
    jsonb_build_array(jsonb_build_object('at', v_now, 'status', case when awaiting then 'awaiting_payment' else 'awaiting_acceptance' end, 'note', 'Order placed', 'by', 'customer')),
    coalesce((p->>'consentWhatsApp')::boolean, false));

  return jsonb_build_object('ok', true, 'token', tok, 'reference', ref);
end $$;

-- ---------- customer tracking ----------
create or replace function public.get_order(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(o) - 'internal_notes' - 'id' from public.orders o where o.tracking_token = p_token $$;

create or replace function public.find_order(p_ref text, p_phone text) returns text
language sql stable security definer set search_path = public as $$
  select tracking_token from public.orders where lower(reference) = lower(trim(p_ref)) and customer_phone = public.normalize_gh_phone(p_phone) $$;

-- ---------- staff actions ----------
create or replace function public.actor() returns text language sql stable as
$$ select coalesce(public.staff_role(), 'unknown') || ':' || coalesce(auth.uid()::text, '') $$;

create or replace function public.admin_transition(p_id uuid, p_to text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype; r text := public.staff_role();
begin
  if r is null then return public.fail('Not authorised.'); end if;
  if r = 'kitchen' and p_to not in ('preparing','ready') then return public.fail('Kitchen staff cannot do that.'); end if;
  if r = 'delivery' and p_to not in ('out_for_delivery','delivered') then return public.fail('Delivery staff cannot do that.'); end if;
  select * into o from public.orders where id = p_id for update;
  if not found then return public.fail('Order not found.'); end if;
  if not exists (select 1 from public.order_transitions where from_status = o.status and to_status = p_to) then
    return public.fail('Cannot move an order from "' || o.status || '" to "' || p_to || '".'); end if;
  if p_to = 'delivered' and o.payment_method = 'manual' and o.payment_status <> 'paid' then
    return public.fail('Payment has not been verified for this order.'); end if;
  update public.orders set status = p_to,
    payment_status = case when p_to = 'delivered' and payment_method = 'cod' then 'paid' else payment_status end,
    refund_due = refund_due or (p_to in ('rejected','cancelled') and payment_status = 'paid'),
    events = events || jsonb_build_object('at', now(), 'status', p_to, 'note', p_note, 'by', public.actor())
  where id = p_id;
  insert into public.audit_logs (actor, action, detail) values (auth.uid(), 'order.' || p_to, o.reference);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_confirm_payment(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  if not public.is_staff(array['owner','manager']) then return public.fail('Not authorised.'); end if;
  select * into o from public.orders where id = p_id for update;
  if not found or o.status <> 'awaiting_payment' then return public.fail('This order is not awaiting payment.'); end if;
  if o.hold_expires_at <= now() then return public.fail('The payment hold expired and the slot was released.'); end if;
  update public.orders set payment_status = 'paid', status = 'awaiting_acceptance', hold_expires_at = null,
    events = events || jsonb_build_object('at', now(), 'status', 'payment_confirmed', 'note', 'Payment verified manually by staff', 'by', public.actor())
                    || jsonb_build_object('at', now(), 'status', 'awaiting_acceptance', 'by', 'system')
  where id = p_id;
  insert into public.audit_logs (actor, action, detail) values (auth.uid(), 'payment.confirmed', o.reference);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_mark_payment_failed(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_staff(array['owner','manager']) then return public.fail('Not authorised.'); end if;
  r := public.admin_transition(p_id, 'payment_failed', 'Payment not received');
  if (r->>'ok')::boolean then update public.orders set payment_status = 'failed' where id = p_id; end if;
  return r;
end $$;

create or replace function public.admin_record_refund(p_id uuid, p_amount int, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype; already int; target text;
begin
  if not public.is_staff(array['owner','manager']) then return public.fail('Not authorised.'); end if;
  select * into o from public.orders where id = p_id for update;
  if not found then return public.fail('Order not found.'); end if;
  if o.payment_status not in ('paid','partially_refunded') then return public.fail('Only paid orders can be refunded.'); end if;
  select coalesce(sum((x->>'amount')::int), 0) into already from jsonb_array_elements(o.refunds) x;
  if p_amount <= 0 or already + p_amount > o.total then return public.fail('Refund amount is invalid or exceeds what was paid.'); end if;
  target := case when already + p_amount = o.total then 'refunded' else 'partially_refunded' end;
  if o.status <> target and not exists (select 1 from public.order_transitions where from_status = o.status and to_status = target) then
    return public.fail('A ' || o.status || ' order cannot be refunded yet. Cancel or complete it first.'); end if;
  update public.orders set refunds = refunds || jsonb_build_object('at', now(), 'amount', p_amount, 'reason', p_reason, 'by', public.actor()),
    payment_status = target, refund_due = false, status = target,
    events = case when status <> target then events || jsonb_build_object('at', now(), 'status', target, 'note', p_reason, 'by', public.actor()) else events end
  where id = p_id;
  insert into public.audit_logs (actor, action, detail) values (auth.uid(), 'refund.recorded', o.reference || ' ' || p_amount);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_add_note(p_id uuid, p_text text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not authorised'; end if;
  update public.orders set internal_notes = internal_notes || to_jsonb(now()::text || '|' || left(p_text, 500)) where id = p_id;
end $$;

create or replace function public.admin_assign_rider(p_id uuid, p_name text, p_phone text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(array['owner','manager']) then raise exception 'Not authorised'; end if;
  update public.orders set rider = case when trim(p_name) = '' then null else jsonb_build_object('name', p_name, 'phone', p_phone) end where id = p_id;
end $$;

-- ---------- function privileges ----------
revoke all on function public.place_order(jsonb), public.get_order(text), public.find_order(text, text), public.capacity_load(date, date),
  public.item_load(text, date, date), public.sweep_expired_holds(), public.admin_transition(uuid, text, text), public.admin_confirm_payment(uuid),
  public.admin_mark_payment_failed(uuid), public.admin_record_refund(uuid, int, text), public.admin_add_note(uuid, text),
  public.admin_assign_rider(uuid, text, text), public.staff_role(), public.is_staff(text[]) from public, anon, authenticated;
grant execute on function public.place_order(jsonb), public.get_order(text), public.find_order(text, text), public.capacity_load(date, date), public.item_load(text, date, date) to anon, authenticated;
grant execute on function public.admin_transition(uuid, text, text), public.admin_confirm_payment(uuid), public.admin_mark_payment_failed(uuid),
  public.admin_record_refund(uuid, int, text), public.admin_add_note(uuid, text), public.admin_assign_rider(uuid, text, text), public.staff_role(), public.is_staff(text[]) to authenticated;
-- RLS policies call is_staff()/staff_role() as the querying role, so anon needs execute on them too (they return false/null for anon)
grant execute on function public.staff_role(), public.is_staff(text[]) to anon;

-- ---------- seed: only facts supplied by the business; everything operational starts closed ----------
insert into public.site_settings (key, value) values
 ('business', '{"name":"Rice and Spice","tagline":"Good Food, Great Vibes","phone":"0547557772","whatsapp":"233547557772","location":"North Legon, Accra, Ghana"}'),
 ('hero', '{"script":"Delicious","headline":"Fried Rice","subheadline":"with Grilled Chicken","description":"Freshly prepared, packed with flavour, and made with love. Pre-order your favourite meal and let Rice and Spice bring the goodness to you.","image":"/hero-dish.jpg"}'),
 ('announcement', '{"enabled":false,"title":"Pre-Orders Are Open!","body":"Freshly prepared meals, made just for you."}'),
 ('about', '"Rice and Spice is an emerging Ghanaian food brand specialising in freshly prepared, flavourful meals. We start with fried rice served with grilled chicken, prepared with care and available through advance pre-orders, and we plan to add more meals over time."'),
 ('faq', '[{"q":"How does pre-ordering work?","a":"Choose your meal, pick an available delivery day and time window, and place your order. We prepare it fresh for your chosen day."},{"q":"Is the delivery window a guaranteed arrival time?","a":"No. It is the window you request. We will do our best to deliver within it and will contact you if anything changes."}]'),
 ('social', '{"instagram":"","facebook":"","tiktok":""}'),
 ('ordering', '{"open":false,"minNoticeHours":12,"maxHorizonDays":14,"cutoffTime":"18:00","cutoffDaysBefore":1,"deliveryWeekdays":[],"windows":[],"dailyCapacity":0,"blackoutDates":[],"holdMinutes":120}'),
 ('services', '{"delivery":true,"pickup":false}'),
 ('payments', '{"manual":{"enabled":false,"instructions":""},"cod":{"enabled":false}}'),
 ('policies', '{"privacy":"","terms":"","refunds":""}'),
 ('whatsappAssisted', 'true'),
 ('notificationTemplates', '{"accepted":"Hi {name}, your Rice and Spice order {ref} has been accepted. Delivery: {date}, {window}.","preparing":"Hi {name}, your order {ref} is now being prepared.","out_for_delivery":"Hi {name}, your order {ref} is out for delivery.","delivered":"Hi {name}, your order {ref} has been delivered. Enjoy your meal!","cancelled":"Hi {name}, your order {ref} has been cancelled. Please contact us if you have questions."}');
insert into public.categories (id, name, sort_order, active) values ('cat-rice', 'Rice Meals', 1, true);
insert into public.menu_items (id, slug, name, description, category_id, price, images, active, featured, sort_order)
values ('item-fried-rice-chicken', 'fried-rice-with-grilled-chicken', 'Fried Rice with Grilled Chicken',
  'Golden, flavourful fried rice served with grilled chicken. Freshly prepared and available by pre-order.', 'cat-rice', 15000, '{"/hero-dish.jpg"}', true, true, 1);
