import { readFileSync } from 'node:fs'

/**
 * The browser tests run against the real Supabase project, so they create real rows.
 * This helper wipes that test data between tests. It is deliberately guarded:
 * it only runs when E2E_ALLOW_DB_RESET=1, and it must NEVER be pointed at a database with real orders.
 */
const REF = (process.env.VITE_SUPABASE_URL ?? readEnv('VITE_SUPABASE_URL') ?? '').match(/https:\/\/([a-z0-9]+)\./)?.[1]

export function readEnv(name: string): string | undefined {
  try { return readFileSync('.env.local', 'utf8').split('\n').find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim() } catch { return undefined }
}

export async function resetDb() {
  if (process.env.E2E_ALLOW_DB_RESET !== '1') throw new Error('Refusing to reset the database: set E2E_ALLOW_DB_RESET=1 (only for a project with no real orders).')
  const token = process.env.SUPABASE_ACCESS_TOKEN ?? readEnv('SUPABASE_ACCESS_TOKEN')
  if (!token || !REF) throw new Error('Missing SUPABASE_ACCESS_TOKEN or VITE_SUPABASE_URL')
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `
      delete from public.orders; delete from public.order_seq; delete from public.coupons; delete from public.delivery_zones;
      update public.menu_items set price = 15000, active = true where id = 'item-fried-rice-chicken';
      update public.site_settings set value = '{"open":false,"minNoticeHours":12,"maxHorizonDays":14,"cutoffTime":"18:00","cutoffDaysBefore":1,"deliveryWeekdays":[],"windows":[],"dailyCapacity":0,"blackoutDates":[],"holdMinutes":120}' where key = 'ordering';
      update public.site_settings set value = value || '{"deliveryFee":0,"areasNote":""}' where key = 'services';
      update public.site_settings set value = '{"manual":{"enabled":false,"instructions":""},"cod":{"enabled":false}}' where key = 'payments';` }),
  })
  if (!res.ok) throw new Error(`DB reset failed: ${res.status} ${await res.text()}`)
}
