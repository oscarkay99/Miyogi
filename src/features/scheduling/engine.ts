import type { DeliveryWindow, OrderingConfig } from '../../data/types'

/**
 * Africa/Accra is GMT+0 all year with no daylight saving, so an Accra wall-clock
 * time equals the same UTC instant. We still use Intl for "what is today in Accra".
 */
export const TIMEZONE = 'Africa/Accra'

export function accraToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export const accraInstant = (date: string, time: string) => new Date(`${date}T${time}:00Z`)

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay()

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** meals already reserved: key `${date}|${windowId}` */
export type Load = Record<string, number>
export const loadKey = (date: string, windowId: string) => `${date}|${windowId}`

export type SlotReason = 'ok' | 'full' | 'too_soon'
export interface SlotState { window: DeliveryWindow; remaining: number; available: boolean; reason: SlotReason }
export interface DateState {
  date: string
  cutoff: Date
  slots: SlotState[]
  available: boolean
  remainingToday: number
}

export type ClosedReason = 'paused' | 'no_windows' | 'blackout' | 'weekday' | 'cutoff' | 'horizon' | 'past' | null

export function dateClosedReason(cfg: OrderingConfig, date: string, now: Date): ClosedReason {
  if (!cfg.open) return 'paused'
  if (cfg.windows.length === 0 || cfg.deliveryWeekdays.length === 0) return 'no_windows'
  const today = accraToday(now)
  if (date < today) return 'past'
  if (date > addDays(today, cfg.maxHorizonDays)) return 'horizon'
  if (cfg.blackoutDates.includes(date)) return 'blackout'
  if (!cfg.deliveryWeekdays.includes(weekdayOf(date))) return 'weekday'
  if (now >= cutoffFor(cfg, date)) return 'cutoff'
  return null
}

export function cutoffFor(cfg: OrderingConfig, date: string): Date {
  return accraInstant(addDays(date, -cfg.cutoffDaysBefore), cfg.cutoffTime)
}

export function dateState(cfg: OrderingConfig, date: string, now: Date, load: Load, itemDailyCap?: number, itemUsed = 0): DateState | null {
  if (dateClosedReason(cfg, date, now)) return null
  const minStart = now.getTime() + cfg.minNoticeHours * 3_600_000
  const dayUsed = cfg.windows.reduce((s, w) => s + (load[loadKey(date, w.id)] ?? 0), 0)
  // dailyCapacity 0 (or unset) means no overall daily limit: only each window's own meal limit applies
  let dayLeft = cfg.dailyCapacity > 0 ? Math.max(0, cfg.dailyCapacity - dayUsed) : Number.POSITIVE_INFINITY
  if (itemDailyCap !== undefined) dayLeft = Math.min(dayLeft, Math.max(0, itemDailyCap - itemUsed))
  const slots: SlotState[] = cfg.windows.map((w) => {
    const used = load[loadKey(date, w.id)] ?? 0
    const remaining = Math.max(0, Math.min(w.capacity - used, dayLeft))
    const tooSoon = accraInstant(date, w.start).getTime() < minStart
    const reason: SlotReason = tooSoon ? 'too_soon' : remaining <= 0 ? 'full' : 'ok'
    return { window: w, remaining, available: reason === 'ok', reason }
  })
  return {
    date,
    cutoff: cutoffFor(cfg, date),
    slots,
    available: slots.some((s) => s.available),
    remainingToday: dayLeft,
  }
}

/** Orderable dates within the horizon, soonest first. Dates that exist but are full are kept so UI can show "Full". */
export function listDates(cfg: OrderingConfig, now: Date, load: Load, itemWeekdays: number[] = [], itemDailyCap?: number, itemLoadByDate: Record<string, number> = {}): DateState[] {
  const today = accraToday(now)
  const out: DateState[] = []
  for (let i = 0; i <= cfg.maxHorizonDays; i++) {
    const date = addDays(today, i)
    if (itemWeekdays.length && !itemWeekdays.includes(weekdayOf(date))) continue
    const s = dateState(cfg, date, now, load, itemDailyCap, itemLoadByDate[date] ?? 0)
    if (s) out.push(s)
  }
  return out
}

export function nextAvailable(states: DateState[]): DateState | undefined {
  return states.find((s) => s.available)
}

export function formatDateLong(date: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${date}T00:00:00Z`))
}
export function formatDateShort(date: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T00:00:00Z`))
}
export function formatCutoff(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: true }).format(d)
}
export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ap = h >= 12 ? 'pm' : 'am'
  return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''}${ap}`
}
