import { describe, expect, it } from 'vitest'
import { computeMetrics, periodRange } from '../features/analytics/metrics'
import type { Order } from '../data/types'

const o = (p: Partial<Order>): Order => ({
  id: 'x', reference: 'r', trackingToken: 't', createdAt: '2026-10-21T10:00:00Z', status: 'delivered', paymentStatus: 'paid', paymentMethod: 'manual',
  lines: [{ itemId: 'i', name: 'Fried Rice', unitPrice: 15000, quantity: 1, options: [], note: '', lineTotal: 15000 }],
  subtotal: 15000, deliveryFee: 2000, discount: 0, total: 17000, customer: { name: '', phone: '', email: '' },
  delivery: { zoneId: 'z', zoneName: 'Z', address: '', landmark: '', instructions: '', date: '2026-10-23', windowId: 'w', windowLabel: 'w' },
  notes: '', internalNotes: [], refunds: [], refundDue: false, events: [], consentWhatsApp: false, ...p,
})

describe('metrics', () => {
  it('counts only collected money as revenue and subtracts refunds', () => {
    const orders = [
      o({ id: '1' }),
      o({ id: '2', status: 'awaiting_payment', paymentStatus: 'pending_verification' }),
      o({ id: '3', status: 'cancelled', paymentStatus: 'failed' }),
      o({ id: '4', status: 'refunded', paymentStatus: 'refunded', refunds: [{ at: '', amount: 17000, reason: '', by: '' }] }),
    ]
    const m = computeMetrics(orders, '2026-10-21', '2026-10-21')
    expect(m.orders).toBe(4)
    expect(m.paidOrders).toBe(2)
    expect(m.grossFood).toBe(30000)
    expect(m.refunds).toBe(17000)
    expect(m.netCollected).toBe(17000)
    expect(m.cancelRate).toBe(0.25)
  })
  it('period ranges', () => {
    const now = new Date('2026-10-21T12:00:00Z')
    expect(periodRange('7d', now)).toEqual({ from: '2026-10-15', to: '2026-10-21' })
    expect(periodRange('month', now).from).toBe('2026-10-01')
    expect(periodRange('yesterday', now).to).toBe('2026-10-20')
  })
})
