import type { Coupon, MenuItem, OrderLine, OrderLineOption } from '../../data/types'
import type { Pesewas } from '../../lib/money'

export interface CartLine { itemId: string; optionIds: string[]; quantity: number; note: string }

export type LineResult = { ok: true; line: OrderLine } | { ok: false; error: string }

/** Resolve a cart line against the catalogue. Prices come from the catalogue only. */
export function resolveLine(item: MenuItem | undefined, cl: CartLine): LineResult {
  if (!item || !item.active) return { ok: false, error: `${item?.name ?? 'An item'} is no longer available.` }
  if (!Number.isInteger(cl.quantity) || cl.quantity < 1 || cl.quantity > 50) return { ok: false, error: `Invalid quantity for ${item.name}.` }
  const chosen: OrderLineOption[] = []
  for (const g of item.optionGroups) {
    const picked = g.options.filter((o) => cl.optionIds.includes(o.id))
    if (g.required && picked.length === 0) return { ok: false, error: `Please choose: ${g.name}.` }
    if (!g.multiple && picked.length > 1) return { ok: false, error: `Only one choice allowed for ${g.name}.` }
    if (g.maxSelect && picked.length > g.maxSelect) return { ok: false, error: `Too many choices for ${g.name}.` }
    picked.forEach((o) => chosen.push({ groupName: g.name, name: o.name, priceDelta: o.priceDelta }))
  }
  const known = new Set(item.optionGroups.flatMap((g) => g.options.map((o) => o.id)))
  if (cl.optionIds.some((id) => !known.has(id))) return { ok: false, error: `An option on ${item.name} is no longer available.` }
  const unitPrice = item.price + chosen.reduce((s, o) => s + o.priceDelta, 0)
  return {
    ok: true,
    line: { itemId: item.id, name: item.name, unitPrice, quantity: cl.quantity, options: chosen, note: cl.note.trim().slice(0, 300), lineTotal: unitPrice * cl.quantity },
  }
}

export interface CouponContext { subtotal: Pesewas; lines: OrderLine[]; now: Date; isFirstOrder: boolean; redemptions: number }

export function couponError(c: Coupon, ctx: CouponContext): string | null {
  if (!c.active) return 'This code is not active.'
  if (c.expiresAt && ctx.now.toISOString().slice(0, 10) > c.expiresAt) return 'This code has expired.'
  if (c.usageLimit !== undefined && ctx.redemptions >= c.usageLimit) return 'This code has reached its usage limit.'
  if (c.firstOrderOnly && !ctx.isFirstOrder) return 'This code is for first orders only.'
  if (ctx.subtotal < c.minSubtotal) return 'Your basket is below the minimum for this code.'
  if (c.itemIds.length && !ctx.lines.some((l) => c.itemIds.includes(l.itemId))) return 'This code does not apply to the items in your basket.'
  return null
}

export interface Totals { subtotal: Pesewas; deliveryFee: Pesewas; discount: Pesewas; total: Pesewas }

/** One coupon max (no stacking). Discount never exceeds what it applies to. */
export function computeTotals(lines: OrderLine[], delivery: { fee: Pesewas } | undefined, coupon: Coupon | undefined): Totals {
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0)
  const deliveryFee = delivery ? delivery.fee : 0
  let discount = 0
  if (coupon) {
    const eligible = coupon.itemIds.length ? lines.filter((l) => coupon.itemIds.includes(l.itemId)).reduce((s, l) => s + l.lineTotal, 0) : subtotal
    if (coupon.type === 'percent') discount = Math.round((eligible * Math.min(100, Math.max(0, coupon.value))) / 100)
    else if (coupon.type === 'fixed') discount = Math.min(eligible, Math.max(0, coupon.value))
    else discount = deliveryFee
  }
  return { subtotal, deliveryFee, discount, total: subtotal + deliveryFee - discount }
}
