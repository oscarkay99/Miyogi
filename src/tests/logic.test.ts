import { describe, expect, it } from 'vitest'
import { normalizeGhPhone } from '../lib/phone'
import { formatGHS } from '../lib/money'
import { dateClosedReason, dateState, listDates, loadKey } from '../features/scheduling/engine'
import { computeTotals, couponError, resolveLine } from '../features/ordering/pricing'
import { canTransition } from '../features/ordering/status'
import type { Coupon, DeliveryZone, MenuItem, OrderingConfig } from '../data/types'

const cfg: OrderingConfig = {
  open: true, minNoticeHours: 12, maxHorizonDays: 14, cutoffTime: '18:00', cutoffDaysBefore: 1,
  deliveryWeekdays: [5], dailyCapacity: 10, blackoutDates: [], holdMinutes: 60,
  windows: [
    { id: 'a', label: '12-2', start: '12:00', end: '14:00', capacity: 6 },
    { id: 'b', label: '2-4', start: '14:00', end: '16:00', capacity: 6 },
  ],
}
// 2026-10-21 is a Wednesday; Friday is 2026-10-23
const wed = new Date('2026-10-21T09:00:00Z')

describe('phone', () => {
  it('normalises Ghana formats', () => {
    for (const v of ['0547557772', '054 755 7772', '+233547557772', '233547557772', '547557772', '00233-54-755-7772'])
      expect(normalizeGhPhone(v)?.e164).toBe('+233547557772')
    expect(normalizeGhPhone('0547557772')?.network).toBe('MTN')
  })
  it('rejects bad numbers', () => {
    for (const v of ['', '12345', '0147557772', '05475577722', 'abc']) expect(normalizeGhPhone(v)).toBeNull()
  })
})

describe('money', () => { it('formats', () => { expect(formatGHS(15000)).toBe('GH₵150'); expect(formatGHS(15050)).toBe('GH₵150.50') }) })

describe('scheduling', () => {
  it('daily capacity 0 means no daily limit (windows still limit)', () => {
    const s = dateState({ ...cfg, dailyCapacity: 0 }, '2026-10-23', wed, { [loadKey('2026-10-23', 'a')]: 5 })!
    expect(s.slots[0].remaining).toBe(1) // window a: 6 - 5
    expect(s.slots[1].remaining).toBe(6) // window b untouched
  })
  it('opens only configured weekdays', () => {
    expect(dateClosedReason(cfg, '2026-10-23', wed)).toBeNull()
    expect(dateClosedReason(cfg, '2026-10-24', wed)).toBe('weekday')
  })
  it('pause closes everything', () => { expect(dateClosedReason({ ...cfg, open: false }, '2026-10-23', wed)).toBe('paused') })
  it('enforces cut-off (Thursday 18:00 for Friday)', () => {
    expect(dateClosedReason(cfg, '2026-10-23', new Date('2026-10-22T17:59:00Z'))).toBeNull()
    expect(dateClosedReason(cfg, '2026-10-23', new Date('2026-10-22T18:00:00Z'))).toBe('cutoff')
  })
  it('blackout and horizon', () => {
    expect(dateClosedReason({ ...cfg, blackoutDates: ['2026-10-23'] }, '2026-10-23', wed)).toBe('blackout')
    expect(dateClosedReason(cfg, '2026-12-25', wed)).toBe('horizon')
  })
  it('minimum notice marks early windows too soon', () => {
    const s = dateState({ ...cfg, minNoticeHours: 60 }, '2026-10-23', wed, {})!
    expect(s.slots[0].reason).toBe('too_soon') // Fri 12:00 is 51h away, under the 60h notice
  })
  it('capacity: window and day caps', () => {
    const s = dateState(cfg, '2026-10-23', wed, { [loadKey('2026-10-23', 'a')]: 6, [loadKey('2026-10-23', 'b')]: 3 })!
    expect(s.slots[0]).toMatchObject({ available: false, reason: 'full' })
    expect(s.slots[1].remaining).toBe(1) // day cap 10 - 9 used
    expect(listDates(cfg, wed, {}).map((d) => d.date)).toEqual(['2026-10-23', '2026-10-30'])
  })
})

const item: MenuItem = {
  id: 'i', slug: 'x', name: 'Fried Rice', description: '', categoryId: 'c', price: 15000, images: [], active: true, featured: true,
  sortOrder: 1, availableWeekdays: [], allergens: '', dietary: '', createdAt: '', updatedAt: '',
  optionGroups: [{ id: 'g', name: 'Extra', required: false, multiple: true, options: [{ id: 'o1', name: 'Extra chicken', priceDelta: 3000 }] },
    { id: 'p', name: 'Size', required: true, multiple: false, options: [{ id: 's1', name: 'Large', priceDelta: 2000 }, { id: 's2', name: 'Small', priceDelta: 0 }] }],
}

describe('pricing', () => {
  it('prices from catalogue, validates required groups', () => {
    expect(resolveLine(item, { itemId: 'i', optionIds: [], quantity: 1, note: '' })).toMatchObject({ ok: false })
    const r = resolveLine(item, { itemId: 'i', optionIds: ['s1', 'o1'], quantity: 2, note: '' })
    expect(r.ok && r.line.lineTotal).toBe((15000 + 2000 + 3000) * 2)
    expect(resolveLine(item, { itemId: 'i', optionIds: ['s1', 's2'], quantity: 1, note: '' })).toMatchObject({ ok: false })
    expect(resolveLine({ ...item, active: false }, { itemId: 'i', optionIds: ['s1'], quantity: 1, note: '' })).toMatchObject({ ok: false })
    expect(resolveLine(item, { itemId: 'i', optionIds: ['s1', 'bogus'], quantity: 1, note: '' })).toMatchObject({ ok: false })
  })
  const line = (resolveLine(item, { itemId: 'i', optionIds: ['s2'], quantity: 2, note: '' }) as any).line
  const zone: DeliveryZone = { id: 'z', name: 'Z', neighbourhoods: '', fee: 2000, minOrder: 0, active: true }
  const c = (o: Partial<Coupon>): Coupon => ({ id: 'c', code: 'X', type: 'percent', value: 10, minSubtotal: 0, active: true, firstOrderOnly: false, itemIds: [], ...o })
  it('totals', () => {
    expect(computeTotals([line], zone, undefined)).toEqual({ subtotal: 30000, deliveryFee: 2000, discount: 0, total: 32000 })
    expect(computeTotals([line], zone, c({}))).toMatchObject({ discount: 3000, total: 29000 })
    expect(computeTotals([line], zone, c({ type: 'fixed', value: 99999 })).discount).toBe(30000)
    expect(computeTotals([line], zone, c({ type: 'free_delivery' }))).toMatchObject({ discount: 2000, total: 30000 })
    expect(computeTotals([line], zone, c({ itemIds: ['other'] })).discount).toBe(0)
  })
  it('coupon rules', () => {
    const ctx = { subtotal: 30000, lines: [line], now: new Date('2026-10-21T00:00:00Z'), isFirstOrder: false, redemptions: 0 }
    expect(couponError(c({}), ctx)).toBeNull()
    expect(couponError(c({ active: false }), ctx)).toBeTruthy()
    expect(couponError(c({ expiresAt: '2026-10-20' }), ctx)).toBeTruthy()
    expect(couponError(c({ usageLimit: 5 }), { ...ctx, redemptions: 5 })).toBeTruthy()
    expect(couponError(c({ firstOrderOnly: true }), ctx)).toBeTruthy()
    expect(couponError(c({ minSubtotal: 50000 }), ctx)).toBeTruthy()
  })
})

describe('status machine', () => {
  it('allows the happy path and blocks jumps', () => {
    expect(canTransition('awaiting_acceptance', 'accepted')).toBe(true)
    expect(canTransition('accepted', 'delivered')).toBe(false)
    expect(canTransition('delivered', 'accepted')).toBe(false)
    expect(canTransition('awaiting_payment', 'preparing')).toBe(false)
  })
})
