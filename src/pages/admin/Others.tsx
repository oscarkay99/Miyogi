import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Modal, Select, TextArea, TextInput, Toggle, useTitle } from '../../components/ui/ui'
import { ExportButton, PageHeader, Stat, Table, downloadFile, readImage, toCSV } from '../../components/admin/kit'
import { saveCoupon, updateSettings, useFullDB } from '../../data/store'
import { computeMetrics, periodRange, type Period } from '../../features/analytics/metrics'
import { formatDateShort } from '../../features/scheduling/engine'
import { useNow } from '../../features/scheduling/hooks'
import { uid } from '../../lib/ids'
import { formatGHS, toCedis, toPesewas } from '../../lib/money'
import type { Coupon, CouponType } from '../../data/types'

/* ---------------- Customers ---------------- */
export function Customers() {
  useTitle('Customers')
  const orders = useFullDB().orders
  const rows = useMemo(() => {
    const m = new Map<string, { name: string; phone: string; email: string; n: number; spend: number; last: string }>()
    for (const o of orders) {
      const e = m.get(o.customer.phone) ?? { name: o.customer.name, phone: o.customer.phone, email: o.customer.email, n: 0, spend: 0, last: '' }
      e.n++; if (o.paymentStatus === 'paid' || o.paymentStatus === 'partially_refunded') e.spend += o.total - o.refunds.reduce((a, r) => a + r.amount, 0)
      if (o.createdAt > e.last) { e.last = o.createdAt; e.name = o.customer.name }
      m.set(o.customer.phone, e)
    }
    return [...m.values()].sort((a, b) => b.last.localeCompare(a.last))
  }, [orders])
  return (
    <>
      <PageHeader title="Customers" sub="Built from orders. We only keep what's needed to deliver." actions={<ExportButton onClick={() => downloadFile('customers.csv', toCSV([['Name', 'Phone', 'Email', 'Orders', 'Paid spend GHS', 'Last order'], ...rows.map((r) => [r.name, r.phone, r.email, r.n, r.spend / 100, r.last.slice(0, 10)])]))} />} />
      {rows.length === 0 ? <EmptyState title="No customers yet" body="Customers appear after their first order." /> : (
        <Table head={['Name', 'Phone', 'Orders', 'Paid spend', 'Last order']}>{rows.map((r) => <tr key={r.phone}><td className="px-4 py-3 font-bold">{r.name}</td><td className="px-4 py-3">{r.phone}</td><td className="px-4 py-3">{r.n}</td><td className="px-4 py-3">{formatGHS(r.spend)}</td><td className="px-4 py-3">{r.last.slice(0, 10)}</td></tr>)}</Table>
      )}
    </>
  )
}

/* ---------------- Payments ---------------- */
export function Payments() {
  useTitle('Payments')
  const db = useFullDB()
  const p = db.settings.payments
  const pending = db.orders.filter((o) => o.paymentStatus === 'pending_verification')
  const refundsDue = db.orders.filter((o) => o.refundDue)
  return (
    <>
      <PageHeader title="Payments" sub="Orders are never marked paid until staff verify the money has arrived." />
      <div className="grid max-w-2xl grid-cols-1 gap-5">
        <Card className="space-y-4 p-5">
          <h2 className="font-bold">Accepted payment methods</h2>
          <Toggle label="Mobile money / bank transfer (manual verification)" checked={p.manual.enabled} onChange={(v) => updateSettings((s) => { s.payments.manual.enabled = v })} />
          <TextArea label="Payment instructions shown to customers" value={p.manual.instructions} onChange={(e) => updateSettings((s) => { s.payments.manual.instructions = e.target.value })} hint="e.g. the MoMo number and account name. Only add details you own." />
          <Toggle label="Pay on delivery" checked={p.cod.enabled} onChange={(v) => updateSettings((s) => { s.payments.cod.enabled = v })} />
        </Card>
      </div>
      <h2 className="mt-8 mb-3 text-xl font-bold">Awaiting verification ({pending.length})</h2>
      {pending.length === 0 ? <p className="text-sm text-ink-500">Nothing waiting.</p> : <Table head={['Order', 'Customer', 'Amount', 'Slot held until']}>{pending.map((o) => <tr key={o.id}><td className="px-4 py-3 font-bold"><Link className="text-brand-700 underline" to="/admin/orders">{o.reference}</Link></td><td className="px-4 py-3">{o.customer.name}</td><td className="px-4 py-3">{formatGHS(o.total)}</td><td className="px-4 py-3">{o.holdExpiresAt?.slice(11, 16)} UTC</td></tr>)}</Table>}
      {refundsDue.length > 0 && <><h2 className="mt-8 mb-3 text-xl font-bold text-red-800">Refunds due ({refundsDue.length})</h2><Table head={['Order', 'Customer', 'Paid']}>{refundsDue.map((o) => <tr key={o.id}><td className="px-4 py-3 font-bold">{o.reference}</td><td className="px-4 py-3">{o.customer.name} · {o.customer.phone}</td><td className="px-4 py-3">{formatGHS(o.total)}</td></tr>)}</Table></>}
    </>
  )
}

/* ---------------- Promotions ---------------- */
export function Promotions() {
  useTitle('Promotions')
  const { coupons, items } = useFullDB()
  const [c, setC] = useState<(Coupon & { v$: string; min$: string }) | null>(null)
  const open = (x?: Coupon) => { const b: Coupon = x ?? { id: uid('cp_'), code: '', type: 'percent', value: 10, minSubtotal: 0, active: false, firstOrderOnly: false, itemIds: [] }; setC({ ...b, v$: b.type === 'percent' ? String(b.value) : toCedis(b.value), min$: toCedis(b.minSubtotal) }) }
  return (
    <>
      <PageHeader title="Promotions" sub="One code per order, no stacking. Codes start switched off." actions={<Button onClick={() => open()}><Plus size={16} /> New code</Button>} />
      {coupons.length === 0 ? <EmptyState title="No promo codes" body="Create percentage, fixed or free-delivery codes." /> : (
        <Table head={['Code', 'Offer', 'Rules', 'Status', '']}>{coupons.map((x) => <tr key={x.id}><td className="px-4 py-3 font-bold">{x.code}</td><td className="px-4 py-3">{x.type === 'percent' ? `${x.value}% off` : x.type === 'fixed' ? `${formatGHS(x.value)} off` : 'Free delivery'}</td><td className="px-4 py-3 text-xs text-ink-700">{[x.firstOrderOnly && 'First order', x.minSubtotal > 0 && `Min ${formatGHS(x.minSubtotal)}`, x.expiresAt && `Until ${x.expiresAt}`, x.usageLimit !== undefined && `Limit ${x.usageLimit}`].filter(Boolean).join(' · ') || '—'}</td><td className="px-4 py-3">{x.active ? <Badge color="green">Active</Badge> : <Badge>Off</Badge>}</td><td className="px-4 py-3"><button className="font-semibold text-brand-700" onClick={() => open(x)}>Edit</button></td></tr>)}</Table>
      )}
      {c && (
        <Modal open onClose={() => setC(null)} title="Promo code">
          <div className="space-y-4">
            <TextInput label="Code" value={c.code} onChange={(e) => setC({ ...c, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
            <Select label="Type" value={c.type} onChange={(e) => setC({ ...c, type: e.target.value as CouponType })}><option value="percent">Percentage off</option><option value="fixed">Fixed amount off</option><option value="free_delivery">Free delivery</option></Select>
            {c.type !== 'free_delivery' && <TextInput label={c.type === 'percent' ? 'Percent (0-100)' : 'Amount (GHS)'} type="number" min="0" value={c.v$} onChange={(e) => setC({ ...c, v$: e.target.value })} />}
            <div className="grid grid-cols-2 gap-3"><TextInput label="Minimum basket (GHS)" type="number" min="0" value={c.min$} onChange={(e) => setC({ ...c, min$: e.target.value })} /><TextInput label="Expires" type="date" value={c.expiresAt ?? ''} onChange={(e) => setC({ ...c, expiresAt: e.target.value || undefined })} /></div>
            <TextInput label="Usage limit (optional)" type="number" min="1" value={c.usageLimit ?? ''} onChange={(e) => setC({ ...c, usageLimit: e.target.value ? Number(e.target.value) : undefined })} />
            <div><p className="mb-1 text-sm font-semibold">Only for items (none = whole basket)</p>{items.map((i) => <label key={i.id} className="mr-4 inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={c.itemIds.includes(i.id)} onChange={(e) => setC({ ...c, itemIds: e.target.checked ? [...c.itemIds, i.id] : c.itemIds.filter((x) => x !== i.id) })} />{i.name}</label>)}</div>
            <Toggle label="First order only" checked={c.firstOrderOnly} onChange={(v) => setC({ ...c, firstOrderOnly: v })} />
            <Toggle label="Active" checked={c.active} onChange={(v) => setC({ ...c, active: v })} />
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setC(null)}>Cancel</Button><Button disabled={!c.code} onClick={async () => { const { v$, min$, ...rest } = c; await saveCoupon({ ...rest, value: c.type === 'percent' ? Math.min(100, Number(v$) || 0) : toPesewas(v$), minSubtotal: toPesewas(min$) }); setC(null) }}>Save</Button></div>
          </div>
        </Modal>
      )}
    </>
  )
}

/* ---------------- Analytics ---------------- */
const PERIODS: [Period, string][] = [['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['month', 'This month'], ['custom', 'Custom']]
function Bars({ rows, format }: { rows: { label: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (!rows.length || rows.every((r) => r.value === 0)) return <p className="py-6 text-center text-sm text-ink-500">No data in this period.</p>
  return <ul className="space-y-2">{rows.map((r) => <li key={r.label} className="grid grid-cols-[7rem_1fr_auto] items-center gap-2 text-sm"><span className="truncate text-ink-700">{r.label}</span><span className="h-3 rounded-full bg-stone-100"><span className="block h-3 rounded-full bg-brand-600" style={{ width: `${(r.value / max) * 100}%` }} /></span><span className="font-semibold tabular-nums">{format ? format(r.value) : r.value}</span></li>)}</ul>
}
export function Analytics() {
  useTitle('Analytics')
  const orders = useFullDB().orders
  const now = useNow()
  const [p, setP] = useState<Period>('7d')
  const [cf, setCf] = useState(''); const [ct, setCt] = useState('')
  const r = periodRange(p, now, cf && ct ? { from: cf, to: ct } : undefined)
  const m = computeMetrics(orders, r.from, r.to)
  const rows = (o: Record<string, number>) => Object.entries(o).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  return (
    <>
      <PageHeader title="Analytics" sub={`${r.from} to ${r.to}. Real orders only; nothing is simulated.`} actions={<ExportButton onClick={() => downloadFile('daily-sales.csv', toCSV([['Day', 'Orders', 'Net revenue GHS'], ...m.byDay.map((d) => [d.day, d.orders, d.revenue / 100])]))} />} />
      <div className="mb-5 flex flex-wrap items-end gap-2">{PERIODS.map(([k, l]) => <button key={k} aria-pressed={p === k} onClick={() => setP(k)} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${p === k ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white'}`}>{l}</button>)}
        {p === 'custom' && <><input aria-label="From" type="date" className="rounded-xl border border-line px-2 py-1.5" value={cf} onChange={(e) => setCf(e.target.value)} /><input aria-label="To" type="date" className="rounded-xl border border-line px-2 py-1.5" value={ct} onChange={(e) => setCt(e.target.value)} /></>}</div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Orders" value={m.orders} hint={`${m.paidOrders} paid`} />
        <Stat label="Gross food sales" value={formatGHS(m.grossFood)} hint="Paid orders, before discounts" />
        <Stat label="Delivery fees" value={formatGHS(m.deliveryFees)} />
        <Stat label="Discounts" value={formatGHS(m.discounts)} />
        <Stat label="Refunds" value={formatGHS(m.refunds)} />
        <Stat label="Net collected" value={formatGHS(m.netCollected)} hint="Paid minus refunds. Not profit: costs aren't tracked." />
        <Stat label="Average order" value={formatGHS(m.avgOrderValue)} />
        <Stat label="Cancellation rate" value={`${Math.round(m.cancelRate * 100)}%`} hint="Cancelled, rejected, failed" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5"><h2 className="mb-3 font-bold">Net revenue by day</h2><Bars rows={m.byDay.slice(-31).map((d) => ({ label: formatDateShort(d.day), value: d.revenue }))} format={formatGHS} /></Card>
        <Card className="p-5"><h2 className="mb-3 font-bold">Sales by menu item</h2><Bars rows={m.byItem.map((i) => ({ label: i.name, value: i.revenue }))} format={formatGHS} /></Card>
        <Card className="p-5"><h2 className="mb-3 font-bold">Orders by status</h2><Bars rows={rows(m.byStatus)} /></Card>
        <Card className="p-5"><h2 className="mb-3 font-bold">Payment method</h2><Bars rows={rows(m.byPayment)} /></Card>
        <Card className="p-5"><h2 className="mb-3 font-bold">Delivery areas</h2><Bars rows={rows(m.byZone)} /></Card>
        <Card className="p-5"><h2 className="mb-3 font-bold">Popular delivery windows</h2><Bars rows={rows(m.byWindow)} /></Card>
      </div>
    </>
  )
}

/* ---------------- Website content ---------------- */
export function Content() {
  useTitle('Website Content')
  const s = useFullDB().settings
  const set = (fn: (x: typeof s) => void) => updateSettings(fn)
  const [err, setErr] = useState('')
  return (
    <>
      <PageHeader title="Website" sub="Changes appear on the site straight away." />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="space-y-4 p-5"><h2 className="font-bold">Homepage hero</h2>
          <TextInput label="Script word (above headline)" value={s.hero.script} onChange={(e) => set((x) => { x.hero.script = e.target.value })} />
          <TextInput label="Headline" value={s.hero.headline} onChange={(e) => set((x) => { x.hero.headline = e.target.value })} />
          <TextInput label="Second line" value={s.hero.subheadline} onChange={(e) => set((x) => { x.hero.subheadline = e.target.value })} />
          <TextArea label="Description" value={s.hero.description} onChange={(e) => set((x) => { x.hero.description = e.target.value })} />
          <div><p className="mb-1.5 text-sm font-semibold text-ink-700">Main food photo</p>{s.hero.image && <img src={s.hero.image} alt="" className="mb-2 h-28 w-28 rounded-full object-cover" />}
            <input type="file" className="w-full max-w-full text-sm" accept="image/png,image/jpeg,image/webp" aria-label="Upload hero photo" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const d = await readImage(f, 1000); set((x) => { x.hero.image = d }); setErr('') } catch (x) { setErr((x as Error).message) } }} />
            {s.hero.image && <button className="ml-3 text-sm font-semibold text-red-700" onClick={() => set((x) => { x.hero.image = '' })}>Remove</button>}{err && <p role="alert" className="text-sm text-red-700">{err}</p>}</div></Card>
        <Card className="space-y-4 p-5"><h2 className="font-bold">Announcement</h2>
          <Toggle label="Show announcement" checked={s.announcement.enabled} onChange={(v) => set((x) => { x.announcement.enabled = v })} />
          <TextInput label="Title" value={s.announcement.title} onChange={(e) => set((x) => { x.announcement.title = e.target.value })} />
          <TextInput label="Message" value={s.announcement.body} onChange={(e) => set((x) => { x.announcement.body = e.target.value })} />
          <h2 className="pt-2 font-bold">Social links</h2>
          {(['instagram', 'facebook', 'tiktok'] as const).map((k) => <TextInput key={k} label={k[0].toUpperCase() + k.slice(1)} placeholder="https://" value={s.social[k]} onChange={(e) => set((x) => { x.social[k] = e.target.value })} />)}</Card>
        <Card className="space-y-4 p-5 lg:col-span-2"><h2 className="font-bold">About us</h2><TextArea label="About text" rows={5} value={s.about} onChange={(e) => set((x) => { x.about = e.target.value })} />
          <h2 className="font-bold">FAQ</h2>
          {s.faq.map((f, i) => <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]"><TextInput label="Question" value={f.q} onChange={(e) => set((x) => { x.faq[i].q = e.target.value })} /><TextInput label="Answer" value={f.a} onChange={(e) => set((x) => { x.faq[i].a = e.target.value })} /><Button className="self-end" variant="ghost" onClick={() => set((x) => { x.faq.splice(i, 1) })}>Remove</Button></div>)}
          <Button variant="secondary" size="sm" onClick={() => set((x) => { x.faq.push({ q: '', a: '' }) })}>Add question</Button></Card>
      </div>
    </>
  )
}

/* ---------------- Settings ---------------- */
export function SettingsPage() {
  useTitle('Settings')
  const db = useFullDB()
  const s = db.settings
  const set = (fn: (x: typeof s) => void) => updateSettings(fn)
  return (
    <>
      <PageHeader title="Business & policies" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="space-y-4 p-5"><h2 className="font-bold">Business</h2>
          <TextInput label="Name" value={s.business.name} onChange={(e) => set((x) => { x.business.name = e.target.value })} />
          <TextInput label="Tagline" value={s.business.tagline} onChange={(e) => set((x) => { x.business.tagline = e.target.value })} />
          <TextInput label="Phone" value={s.business.phone} onChange={(e) => set((x) => { x.business.phone = e.target.value })} />
          <TextInput label="WhatsApp number (international, no +)" value={s.business.whatsapp} onChange={(e) => set((x) => { x.business.whatsapp = e.target.value })} />
          <TextInput label="Location" value={s.business.location} onChange={(e) => set((x) => { x.business.location = e.target.value })} />
          <Toggle label="Offer “Order via WhatsApp” at checkout" checked={s.whatsappAssisted} onChange={(v) => set((x) => { x.whatsappAssisted = v })} />
          <p className="text-xs text-ink-500">Delivery only. Pickup and walk-in service stay off until you enable them in a later release.</p></Card>
        <Card className="space-y-4 p-5"><h2 className="font-bold">Policies shown to customers</h2><p className="text-xs text-ink-500">Leave blank until you've decided. Customers see “being finalised”.</p>
          <TextArea label="Terms and Conditions" rows={4} value={s.policies.terms} onChange={(e) => set((x) => { x.policies.terms = e.target.value })} />
          <TextArea label="Refund and Cancellation Policy" rows={4} value={s.policies.refunds} onChange={(e) => set((x) => { x.policies.refunds = e.target.value })} />
          <TextArea label="Privacy Policy" rows={4} value={s.policies.privacy} onChange={(e) => set((x) => { x.policies.privacy = e.target.value })} /></Card>
        <Card className="space-y-3 p-5"><h2 className="font-bold">WhatsApp message templates</h2><p className="text-xs text-ink-500">Used to prefill a WhatsApp chat from the order screen. Automatic sending needs the WhatsApp Business API and a backend, which isn't connected. Placeholders: {'{name} {ref} {date} {window}'}</p>
          {Object.keys(s.notificationTemplates).map((k) => <TextArea key={k} label={k.replace(/_/g, ' ')} rows={2} value={s.notificationTemplates[k]} onChange={(e) => set((x) => { x.notificationTemplates[k] = e.target.value })} />)}</Card>
        <Card className="space-y-3 p-5"><h2 className="font-bold">Data and activity</h2>
          <p className="text-sm text-ink-500">Everything is stored securely in your Supabase database. Download a copy any time.</p>
          <div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={() => downloadFile('rice-and-spice-backup.json', JSON.stringify(db, null, 2), 'application/json')}>Download backup</Button></div>
          <h2 className="pt-3 font-bold">Recent activity</h2>
          <ul tabIndex={0} aria-label="Recent activity" className="max-h-56 space-y-1 overflow-y-auto text-xs text-ink-700">{db.audit.length === 0 && <li>No activity yet.</li>}{db.audit.slice(0, 40).map((a, i) => <li key={i}>{a.at.slice(0, 16).replace('T', ' ')} · {a.action} {a.detail}</li>)}</ul></Card>
      </div>
    </>
  )
}
