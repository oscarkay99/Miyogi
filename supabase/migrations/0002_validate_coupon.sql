-- Lets checkout preview a promo code without exposing the coupons table.
-- Anyone holding a valid code learns only that code's terms. place_order re-checks everything.
create or replace function public.validate_coupon(p_code text, p_phone text, p_subtotal int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare cp public.coupons%rowtype; phone text := public.normalize_gh_phone(p_phone);
        redemptions int; prior int; v_today date := (now() at time zone 'Africa/Accra')::date;
begin
  select * into cp from public.coupons where lower(code) = lower(trim(coalesce(p_code, '')));
  if not found then return public.fail('That promo code is not valid.'); end if;
  if not cp.active then return public.fail('This code is not active.'); end if;
  if cp.expires_at is not null and v_today > cp.expires_at then return public.fail('This code has expired.'); end if;
  select count(*) into redemptions from public.orders where coupon_code = cp.code and status not in ('cancelled','payment_failed','rejected');
  if cp.usage_limit is not null and redemptions >= cp.usage_limit then return public.fail('This code has reached its usage limit.'); end if;
  if cp.first_order_only and phone is not null then
    select count(*) into prior from public.orders where customer_phone = phone and status not in ('cancelled','payment_failed','rejected');
    if prior > 0 then return public.fail('This code is for first orders only.'); end if;
  end if;
  if p_subtotal < cp.min_subtotal then return public.fail('Your basket is below the minimum for this code.'); end if;
  return jsonb_build_object('ok', true, 'coupon', jsonb_build_object('id', cp.id, 'code', cp.code, 'type', cp.type, 'value', cp.value,
    'minSubtotal', cp.min_subtotal, 'itemIds', to_jsonb(cp.item_ids), 'firstOrderOnly', cp.first_order_only, 'active', true));
end $$;
revoke all on function public.validate_coupon(text, text, int) from public, anon, authenticated;
grant execute on function public.validate_coupon(text, text, int) to anon, authenticated;
