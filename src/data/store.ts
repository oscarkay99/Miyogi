import { useEffect, useState, useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import { defaultSettings } from './seed'
import { accraToday, addDays, loadKey, type Load } from '../features/scheduling/engine'
import type { CartLine } from '../features/ordering/pricing'
import type { CapacityRow, Category, Coupon, DB, DeliveryZone, MenuItem, Order, OrderStatus, PaymentMethod, Settings } from './types'

/**
 * All data access lives here. Customers read public tables and call order functions;
 * staff additionally read orders/coupons/audit. Every rule that matters (pricing, cut-off,
 * capacity, state transitions, permissions) is enforced in the database, not in this file.
 */

const empty = (): DB => ({ settings: defaultSettings(), categories: [], items: [], zones: [], coupons: [], orders: [], audit: [], capacity: [], itemLoads: {} })

let db: DB = empty()
let status: 'loading' | 'ready' | 'error' = 'loading'
let errorMsg = ''
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb) } }

export const getDB = () => db

/** Subscribe to the (referentially stable) snapshot, then derive. Selectors may allocate freely. */
export function useDB<T>(select: (d: DB) => T): T {
  return select(useSyncExternalStore(subscribe, () => db))
}
export const useFullDB = () => useDB((d) => d)
export function useDataStatus() {
  useSyncExternalStore(subscribe, () => status)
  return { status, error: errorMsg }
}

// ---------- row mappers ----------
type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const toItem = (r: Row): MenuItem => ({
  id: r.id, slug: r.slug, name: r.name, description: r.description, categoryId: r.category_id, price: r.price, images: r.images ?? [],
  active: r.active, featured: r.featured, sortOrder: r.sort_order, availableWeekdays: r.available_weekdays ?? [],
  dailyLimit: r.daily_limit ?? undefined, allergens: r.allergens, dietary: r.dietary, optionGroups: r.option_groups ?? [],
  createdAt: r.created_at, updatedAt: r.updated_at,
})
const fromItem = (i: MenuItem) => ({
  id: i.id, slug: i.slug, name: i.name, description: i.description, category_id: i.categoryId, price: i.price, images: i.images,
  active: i.active, featured: i.featured, sort_order: i.sortOrder, available_weekdays: i.availableWeekdays, daily_limit: i.dailyLimit ?? null,
  allergens: i.allergens, dietary: i.dietary, option_groups: i.optionGroups, updated_at: new Date().toISOString(),
})
const toZone = (r: Row): DeliveryZone => ({ id: r.id, name: r.name, neighbourhoods: r.neighbourhoods, fee: r.fee, minOrder: r.min_order, active: r.active })
const toCategory = (r: Row): Category => ({ id: r.id, name: r.name, sortOrder: r.sort_order, active: r.active })
const toCoupon = (r: Row): Coupon => ({
  id: r.id, code: r.code, type: r.type, value: r.value, minSubtotal: r.min_subtotal, active: r.active, expiresAt: r.expires_at ?? undefined,
  usageLimit: r.usage_limit ?? undefined, firstOrderOnly: r.first_order_only, itemIds: r.item_ids ?? [],
})
export const toOrder = (r: Row): Order => ({
  id: r.id ?? '', reference: r.reference, trackingToken: r.tracking_token, createdAt: r.created_at, status: r.status, paymentStatus: r.payment_status,
  paymentMethod: r.payment_method, holdExpiresAt: r.hold_expires_at ?? undefined, lines: r.lines, subtotal: r.subtotal, deliveryFee: r.delivery_fee,
  discount: r.discount, total: r.total, couponCode: r.coupon_code ?? undefined,
  customer: { name: r.customer_name, phone: r.customer_phone, email: r.customer_email },
  delivery: { zoneId: r.zone_id, zoneName: r.zone_name, address: r.address, landmark: r.landmark, instructions: r.instructions, date: r.delivery_date, windowId: r.window_id, windowLabel: r.window_label },
  notes: r.notes, internalNotes: r.internal_notes ?? [], refunds: r.refunds ?? [], refundDue: r.refund_due, rider: r.rider ?? undefined,
  events: r.events ?? [], consentWhatsApp: r.consent_whatsapp,
})

// ---------- loading ----------
let inflight: Promise<void> | null = null
let rerun = false
/** Bumped by every local write. A load that started before a write must not overwrite it with older data. */
let epoch = 0

/** Reload everything. A request made while a load is running triggers one more load afterwards, so writes are never shown stale. */
export function refresh(): Promise<void> {
  if (inflight) { rerun = true; return inflight }
  inflight = (async () => { do { rerun = false; await load() } while (rerun) })().finally(() => { inflight = null })
  return inflight
}

async function load() {
  const startedAt = epoch
  try {
    const today = accraToday(new Date())
    const [settings, cats, items, zones, cap, session] = await Promise.all([
      supabase.from('site_settings').select('key,value'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('menu_items').select('*').order('sort_order'),
      supabase.from('delivery_zones').select('*').order('name'),
      supabase.rpc('capacity_load', { p_from: addDays(today, -1), p_to: addDays(today, 60) }),
      supabase.auth.getSession(),
    ])
    const firstError = [settings, cats, items, zones, cap].find((r) => r.error)?.error
    if (firstError) throw new Error(firstError.message)

    const merged = defaultSettings() as unknown as Record<string, unknown>
    for (const r of settings.data ?? []) merged[r.key] = r.value
    const itemList = (items.data ?? []).map(toItem)

    const itemLoads: DB['itemLoads'] = {}
    await Promise.all(itemList.filter((i) => i.dailyLimit !== undefined).map(async (i) => {
      const { data } = await supabase.rpc('item_load', { p_item: i.id, p_from: addDays(today, -1), p_to: addDays(today, 60) })
      itemLoads[i.id] = Object.fromEntries((data ?? []).map((x: Row) => [x.delivery_date, x.meals]))
    }))

    let orders: Order[] = [], coupons: Coupon[] = [], audit: DB['audit'] = []
    if (session.data.session) {
      const [o, c, a] = await Promise.all([
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(1000),
        supabase.from('coupons').select('*'),
        supabase.from('audit_logs').select('*').order('at', { ascending: false }).limit(100),
      ])
      orders = (o.data ?? []).map(toOrder)
      coupons = (c.data ?? []).map(toCoupon)
      audit = (a.data ?? []).map((x: Row) => ({ at: x.at, by: x.actor ?? '', action: x.action, detail: x.detail }))
    }

    if (startedAt !== epoch) { rerun = true; return } // a write landed mid-load: this snapshot is stale, load again
    db = {
      settings: merged as unknown as Settings,
      categories: (cats.data ?? []).map(toCategory), items: itemList, zones: (zones.data ?? []).map(toZone),
      coupons, orders, audit,
      capacity: (cap.data ?? []).map((x: Row) => ({ date: x.delivery_date, windowId: x.window_id, meals: x.meals })), itemLoads,
    }
    status = 'ready'; errorMsg = ''
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : 'Could not reach the server.'
    status = db.items.length ? 'ready' : 'error' // keep showing stale data if we already have some
  }
  emit()
}

/** Cheap partial reloads: capacity only (after an order) and orders + capacity (after a staff action). */
async function loadCapacity(): Promise<CapacityRow[]> {
  const today = accraToday(new Date())
  const { data } = await supabase.rpc('capacity_load', { p_from: addDays(today, -1), p_to: addDays(today, 60) })
  return (data ?? []).map((x: Row) => ({ date: x.delivery_date, windowId: x.window_id, meals: x.meals }))
}
export async function refreshCapacity() { db = { ...db, capacity: await loadCapacity() }; emit() }
export async function refreshOrders() {
  const [o, capacity] = await Promise.all([
    supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(1000),
    loadCapacity(),
  ])
  db = { ...db, orders: o.error ? db.orders : (o.data ?? []).map(toOrder), capacity }
  emit()
}

void refresh()
if (typeof window !== 'undefined') {
  setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 30_000)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void refresh() })
}

// ---------- capacity helpers (used by the scheduling UI; the database re-checks on order) ----------
export function computeLoad(d: DB, _now?: Date): Load {
  const out: Load = {}
  for (const r of d.capacity) out[loadKey(r.date, r.windowId)] = r.meals
  return out
}
export const itemLoadByDate = (d: DB, itemId: string, _now?: Date): Record<string, number> => d.itemLoads[itemId] ?? {}

// ---------- customers ----------
export interface PlaceOrderInput {
  lines: CartLine[]
  name: string; phone: string; email: string
  area: string; address: string; landmark: string; instructions: string
  date: string; windowId: string; notes: string
  paymentMethod: PaymentMethod
  couponCode: string
  consentWhatsApp: boolean
}
export type PlaceResult = { ok: true; token: string; reference: string } | { ok: false; errors: string[]; fieldErrors?: Record<string, string> }

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceResult> {
  const { data, error } = await supabase.rpc('place_order', { p: input })
  if (error) return { ok: false, errors: ['We could not reach the server. Check your connection and try again.'] }
  void refreshCapacity()
  return data as PlaceResult
}

export async function fetchOrder(token: string): Promise<Order | null> {
  const { data } = await supabase.rpc('get_order', { p_token: token })
  return data ? toOrder(data as Row) : null
}
export function useOrder(token: string | undefined) {
  const [state, setState] = useState<{ order: Order | null; loading: boolean }>({ order: null, loading: true })
  useEffect(() => {
    if (!token) return
    let live = true
    const pull = () => fetchOrder(token).then((o) => live && setState({ order: o, loading: false }))
    void pull()
    const t = setInterval(pull, 20_000)
    return () => { live = false; clearInterval(t) }
  }, [token])
  return state
}
export async function findOrderToken(ref: string, phone: string): Promise<string | null> {
  const { data } = await supabase.rpc('find_order', { p_ref: ref, p_phone: phone })
  return (data as string | null) ?? null
}
export async function validateCoupon(code: string, phone: string, subtotal: number): Promise<{ ok: true; coupon: Coupon } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('validate_coupon', { p_code: code, p_phone: phone, p_subtotal: subtotal })
  if (error || !data) return { ok: false, error: 'Could not check that code right now.' }
  return data.ok ? { ok: true, coupon: data.coupon as Coupon } : { ok: false, error: data.errors?.[0] ?? 'Invalid code.' }
}

// ---------- staff: order actions (permissions and state machine enforced by the database) ----------
export type ActionResult = { ok: true } | { ok: false; error: string }

async function action(fn: string, args: Record<string, unknown>): Promise<ActionResult> {
  const { data, error } = await supabase.rpc(fn, args)
  await refreshOrders()
  if (error) return { ok: false, error: error.message }
  if (data && data.ok === false) return { ok: false, error: data.errors?.[0] ?? 'Not allowed.' }
  return { ok: true }
}
export const transitionOrder = (id: string, to: OrderStatus, note?: string) => action('admin_transition', { p_id: id, p_to: to, p_note: note ?? null })
export const confirmManualPayment = (id: string) => action('admin_confirm_payment', { p_id: id })
export const markPaymentFailed = (id: string) => action('admin_mark_payment_failed', { p_id: id })
export const recordRefund = (id: string, amount: number, reason: string) => action('admin_record_refund', { p_id: id, p_amount: amount, p_reason: reason })
export const addInternalNote = (id: string, text: string) => action('admin_add_note', { p_id: id, p_text: text })
export const assignRider = (id: string, name: string, phone: string) => action('admin_assign_rider', { p_id: id, p_name: name, p_phone: phone })

// ---------- staff: configuration ----------
/** Optimistic write: the screen updates now; if the server refuses, reload the truth and report why. */
async function write(apply: () => void, p: PromiseLike<{ error: { message: string } | null }>): Promise<ActionResult> {
  epoch++; apply(); emit()
  const { error } = await p
  if (error) { await refresh(); return { ok: false, error: error.message } }
  return { ok: true }
}
const upsertById = <T extends { id: string }>(list: T[], row: T) => (list.some((x) => x.id === row.id) ? list.map((x) => (x.id === row.id ? row : x)) : [...list, row])

const pending = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Optimistic: the UI updates instantly. Changed keys are saved after a short pause (typing-friendly),
 * or straight away with `immediate`. Resolves once everything queued by this call has been written.
 */
export function updateSettings(fn: (s: Settings) => void, immediate = false): Promise<void> {
  const before = db.settings as unknown as Record<string, unknown>
  const next = structuredClone(db.settings)
  fn(next)
  const after = next as unknown as Record<string, unknown>
  epoch++
  db = { ...db, settings: next }
  emit()
  const writes: Promise<void>[] = []
  for (const key of Object.keys(after)) {
    if (JSON.stringify(after[key]) === JSON.stringify(before[key])) continue
    clearTimeout(pending.get(key))
    writes.push(new Promise<void>((resolve) => {
      const run = async () => {
        pending.delete(key)
        const { error } = await supabase.from('site_settings').upsert({ key, value: after[key], updated_at: new Date().toISOString() })
        if (error) await refresh()
        resolve()
      }
      if (immediate) void run(); else pending.set(key, setTimeout(run, 300))
    }))
  }
  return Promise.all(writes).then(() => undefined)
}

export const saveItem = (i: MenuItem) => write(() => { db = { ...db, items: upsertById(db.items, i) } }, supabase.from('menu_items').upsert(fromItem(i)))
export const saveCategory = (c: Category) => write(() => { db = { ...db, categories: upsertById(db.categories, c) } }, supabase.from('categories').upsert({ id: c.id, name: c.name, sort_order: c.sortOrder, active: c.active }))
export const saveZone = (z: DeliveryZone) => write(() => { db = { ...db, zones: upsertById(db.zones, z) } }, supabase.from('delivery_zones').upsert({ id: z.id, name: z.name, neighbourhoods: z.neighbourhoods, fee: z.fee, min_order: z.minOrder, active: z.active }))
export const saveCoupon = (c: Coupon) => write(() => { db = { ...db, coupons: upsertById(db.coupons, c) } }, supabase.from('coupons').upsert({
  id: c.id, code: c.code, type: c.type, value: c.value, min_subtotal: c.minSubtotal, active: c.active, expires_at: c.expiresAt ?? null,
  usage_limit: c.usageLimit ?? null, first_order_only: c.firstOrderOnly, item_ids: c.itemIds,
}))

/** Labelled sample schedule, zone and payment methods so the owner can try the full flow. */
export async function loadSampleConfig() {
  await updateSettings((s) => {
    s.ordering = {
      ...s.ordering, open: true, deliveryWeekdays: [5, 6],
      windows: [
        { id: 'w1', label: '12:00 – 14:00', start: '12:00', end: '14:00', capacity: 15 },
        { id: 'w2', label: '14:00 – 16:00', start: '14:00', end: '16:00', capacity: 15 },
        { id: 'w3', label: '16:00 – 18:00', start: '16:00', end: '18:00', capacity: 15 },
      ],
    }
    s.payments = { manual: { enabled: true, instructions: 'SAMPLE: Send payment to the MoMo number provided by the owner and use your order reference as the narration.' }, cod: { enabled: true } }
    s.services = { ...s.services, deliveryFee: 2000, areasNote: 'SAMPLE: North Legon and nearby' }
  }, true)
}
