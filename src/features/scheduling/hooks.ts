import { useEffect, useMemo, useState } from 'react'
import { computeLoad, itemLoadByDate, useFullDB } from '../../data/store'
import { listDates, nextAvailable } from './engine'

export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => { setNow(new Date()) }, intervalMs); return () => clearInterval(t) }, [intervalMs])
  return now
}

/** Orderable dates for the current basket (respects product weekday/daily limits). */
export function useDates(itemIdList: string[] = []) {
  const db = useFullDB()
  const now = useNow()
  const idKey = itemIdList.join(',')
  return useMemo(() => {
    const itemIds = idKey ? idKey.split(',') : []
    const load = computeLoad(db, now)
    const items = db.items.filter((i) => itemIds.includes(i.id))
    // intersect weekday restrictions; use the tightest daily cap
    let weekdays: number[] = []
    for (const i of items) if (i.availableWeekdays.length) weekdays = weekdays.length ? weekdays.filter((d) => i.availableWeekdays.includes(d)) : i.availableWeekdays
    const capped = items.find((i) => i.dailyLimit !== undefined)
    const dates = listDates(db.settings.ordering, now, load, weekdays, capped?.dailyLimit, capped ? itemLoadByDate(db, capped.id, now) : {})
    return { dates, next: nextAvailable(dates), open: db.settings.ordering.open, configured: db.settings.ordering.windows.length > 0 && db.settings.ordering.deliveryWeekdays.length > 0, now }
  }, [db, now, idKey])
}
