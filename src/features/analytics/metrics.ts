import type { Order } from '../../data/types'
import { accraToday, addDays } from '../scheduling/engine'

export type Period = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'custom'

export function periodRange(p: Period, now: Date, custom?: { from: string; to: string }): { from: string; to: string } {
  const today = accraToday(now)
  switch (p) {
    case 'today': return { from: today, to: today }
    case 'yesterday': return { from: addDays(today, -1), to: addDays(today, -1) }
    case '7d': return { from: addDays(today, -6), to: today }
    case '30d': return { from: addDays(today, -29), to: today }
    case 'month': return { from: `${today.slice(0, 8)}01`, to: today }
    default: return custom ?? { from: today, to: today }
  }
}

const orderDay = (o: Order) => accraToday(new Date(o.createdAt))
/** Money has really been collected only when payment is paid / part-refunded / refunded. */
const collected = (o: Order) => o.paymentStatus === 'paid' || o.paymentStatus === 'partially_refunded' || o.paymentStatus === 'refunded'

export interface Metrics {
  orders: number
  paidOrders: number
  grossFood: number // food subtotal of orders that were actually paid
  deliveryFees: number
  discounts: number
  refunds: number
  netCollected: number // paid totals minus refunds. Not profit.
  avgOrderValue: number
  cancelRate: number
  byDay: { day: string; revenue: number; orders: number }[]
  byItem: { name: string; qty: number; revenue: number }[]
  byStatus: Record<string, number>
  byPayment: Record<string, number>
  byZone: Record<string, number>
  byWindow: Record<string, number>
}

export function computeMetrics(all: Order[], from: string, to: string): Metrics {
  const orders = all.filter((o) => { const d = orderDay(o); return d >= from && d <= to })
  const paid = orders.filter(collected)
  const refunds = paid.reduce((n, o) => n + o.refunds.reduce((m, r) => m + r.amount, 0), 0)
  const gross = paid.reduce((n, o) => n + o.subtotal, 0)
  const fees = paid.reduce((n, o) => n + o.deliveryFee, 0)
  const disc = paid.reduce((n, o) => n + o.discount, 0)
  const totalPaid = paid.reduce((n, o) => n + o.total, 0)
  const dayMap = new Map<string, { revenue: number; orders: number }>()
  for (let d = from; d <= to; d = addDays(d, 1)) dayMap.set(d, { revenue: 0, orders: 0 })
  orders.forEach((o) => { const e = dayMap.get(orderDay(o)); if (e) { e.orders++; if (collected(o)) e.revenue += o.total - o.refunds.reduce((m, r) => m + r.amount, 0) } })
  const items = new Map<string, { qty: number; revenue: number }>()
  paid.forEach((o) => o.lines.forEach((l) => { const e = items.get(l.name) ?? { qty: 0, revenue: 0 }; e.qty += l.quantity; e.revenue += l.lineTotal; items.set(l.name, e) }))
  const count = (f: (o: Order) => string, src = orders) => src.reduce<Record<string, number>>((m, o) => { const k = f(o); m[k] = (m[k] ?? 0) + 1; return m }, {})
  const cancelled = orders.filter((o) => ['cancelled', 'rejected', 'payment_failed'].includes(o.status)).length
  return {
    orders: orders.length, paidOrders: paid.length, grossFood: gross, deliveryFees: fees, discounts: disc, refunds,
    netCollected: totalPaid - refunds,
    avgOrderValue: paid.length ? Math.round(totalPaid / paid.length) : 0,
    cancelRate: orders.length ? cancelled / orders.length : 0,
    byDay: [...dayMap].map(([day, v]) => ({ day, ...v })),
    byItem: [...items].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue),
    byStatus: count((o) => o.status), byPayment: count((o) => o.paymentMethod),
    byZone: count((o) => o.delivery.zoneName), byWindow: count((o) => o.delivery.windowLabel),
  }
}
