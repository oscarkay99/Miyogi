import { Link } from 'react-router-dom'
import { CheckCircle2, ChefHat, Circle, PartyPopper } from 'lucide-react'
import { Badge, Button, Card, EmptyState, useConfirm, useTitle } from '../../components/ui/ui'
import { PageHeader, Stat } from '../../components/admin/kit'
import { confirmManualPayment, loadSampleConfig, transitionOrder, useFullDB } from '../../data/store'
import { useAuth } from '../../data/auth'
import { computeMetrics, periodRange } from '../../features/analytics/metrics'
import { NEXT_STEP } from '../../features/ordering/status'
import { accraToday, formatDateLong } from '../../features/scheduling/engine'
import { useNow } from '../../features/scheduling/hooks'
import { formatGHS } from '../../lib/money'
import type { Order } from '../../data/types'

const dishLabel = (l: Order['lines'][number]) => `${l.name}${l.options.length ? ` (${l.options.map((o) => o.name).join(', ')})` : ''}`

export default function Today() {
  useTitle('Today')
  const db = useFullDB()
  const { role } = useAuth()
  const now = useNow(30_000)
  const { confirm, node } = useConfirm()
  const today = accraToday(now)
  const showMoney = role === 'owner' || role === 'manager'

  const needsYou = db.orders.filter((o) => o.status === 'awaiting_payment' || o.status === 'awaiting_acceptance' || o.refundDue)
  const cooking = db.orders.filter((o) => ['accepted', 'preparing', 'ready', 'out_for_delivery'].includes(o.status) && o.delivery.date >= today)
  const dates = [...new Set(cooking.map((o) => o.delivery.date))].sort()
  const m = computeMetrics(db.orders, ...(Object.values(periodRange('7d', now)) as [string, string]))

  const cfg = db.settings.ordering
  const checks = [
    { ok: cfg.deliveryWeekdays.length > 0 && cfg.windows.length > 0, label: 'Set your delivery days and time windows', to: '/admin/setup?tab=times' },
    { ok: db.settings.services.deliveryFee > 0 || db.settings.services.areasNote.trim() !== '', label: 'Set your delivery fee and the areas you cover', to: '/admin/setup?tab=delivery' },
    { ok: db.settings.payments.manual.enabled || db.settings.payments.cod.enabled, label: 'Choose how customers pay', to: '/admin/setup?tab=payments' },
    { ok: !!(db.settings.policies.terms && db.settings.policies.refunds), label: 'Write your terms and refund policy', to: '/admin/setup?tab=business' },
    { ok: cfg.open, label: 'Open pre-orders', to: '/admin/setup?tab=times' },
  ]

  return (
    <>
      {node}
      <PageHeader title="Today" sub={formatDateLong(today)} />

      {!checks.every((c) => c.ok) && role !== 'kitchen' && role !== 'delivery' && (
        <Card className="mb-6 p-5">
          <h2 className="text-lg font-bold">Get ready to take orders</h2>
          <p className="mb-3 text-sm text-ink-500">Customers can't order until these are done.</p>
          <ul className="space-y-2">{checks.map((c) => <li key={c.label}><Link to={c.to} className="flex items-center gap-2 text-sm font-semibold hover:text-brand-700">{c.ok ? <CheckCircle2 size={18} className="text-fresh" /> : <Circle size={18} className="text-stone-300" />}{c.label}</Link></li>)}</ul>
          {!db.settings.services.areasNote.startsWith('SAMPLE') && showMoney && <p className="mt-4 border-t border-line pt-4 text-sm text-ink-500">Just trying it out? <button className="font-semibold text-brand-700 underline" onClick={() => void loadSampleConfig()}>Load sample configuration</button> (clearly marked as sample).</p>}
        </Card>
      )}

      <section aria-labelledby="needs">
        <h2 id="needs" className="mb-3 text-xl font-bold">Needs you {needsYou.length > 0 && <Badge color="orange">{needsYou.length}</Badge>}</h2>
        {needsYou.length === 0 ? <EmptyState icon={<PartyPopper size={32} />} title="All caught up" body="New orders that need your attention will show up here." /> : (
          <div className="space-y-3">{needsYou.map((o) => (
            <Card key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <Link to={`/admin/orders?open=${o.id}`} className="min-w-0">
                <p className="font-bold">{o.customer.name} <span className="font-normal text-ink-500">· {o.reference}</span></p>
                <p className="text-sm text-ink-700">{o.lines.map((l) => `${l.quantity} × ${l.name}`).join(', ')} · {formatGHS(o.total)}</p>
                <p className="text-xs text-ink-500">{o.delivery.date} · {o.delivery.windowLabel}</p>
              </Link>
              <div className="flex gap-2">
                {o.status === 'awaiting_payment' && showMoney && <Button size="sm" onClick={() => confirm('Confirm payment received?', 'Only confirm after you have seen the money in your account.', () => void confirmManualPayment(o.id), 'Payment received')}>Payment received</Button>}
                {o.status === 'awaiting_acceptance' && <>
                  <Button size="sm" onClick={() => void transitionOrder(o.id, 'accepted')}>Accept</Button>
                  <Button size="sm" variant="secondary" onClick={() => confirm('Reject this order?', o.paymentStatus === 'paid' ? 'The customer has paid, so a refund will be flagged.' : 'The customer will be told it was rejected.', () => void transitionOrder(o.id, 'rejected'), 'Reject order', true)}>Reject</Button>
                </>}
                {o.refundDue && <Link to={`/admin/orders?open=${o.id}`}><Button size="sm" variant="danger">Refund due</Button></Link>}
                {o.status === 'awaiting_payment' && !showMoney && <Badge color="yellow">Waiting for payment</Badge>}
              </div>
            </Card>))}</div>
        )}
      </section>

      <section aria-labelledby="cook" className="mt-10">
        <h2 id="cook" className="mb-3 text-xl font-bold">Coming up</h2>
        {dates.length === 0 ? <EmptyState icon={<ChefHat size={32} />} title="Nothing to cook yet" body="Accepted orders will appear here by delivery day, with a cooking list." /> : dates.map((d) => {
          const day = cooking.filter((o) => o.delivery.date === d)
          const totals = new Map<string, number>()
          day.forEach((o) => o.lines.forEach((l) => totals.set(dishLabel(l), (totals.get(dishLabel(l)) ?? 0) + l.quantity)))
          return (
            <Card key={d} className="mb-4 p-4 sm:p-5">
              <h3 className="text-lg font-extrabold">{d === today ? 'Today' : formatDateLong(d)}</h3>
              <ul className="my-2 flex flex-wrap gap-2">{[...totals].map(([n, q]) => <li key={n} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">Cook {q} × {n}</li>)}</ul>
              <ul className="divide-y divide-line">{day.map((o) => {
                const next = NEXT_STEP[o.status]
                return (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <Link to={`/admin/orders?open=${o.id}`} className="min-w-0"><b>{o.delivery.windowLabel}</b> · {o.customer.name}<span className="block text-xs text-ink-500">{o.lines.map((l) => `${l.quantity} × ${l.name}${l.note ? ` — “${l.note}”` : ''}`).join(', ')}{o.notes && ` · Note: ${o.notes}`}</span></Link>
                    {next && <Button size="sm" variant={o.status === 'accepted' ? 'primary' : 'secondary'} onClick={() => void transitionOrder(o.id, next.to)}>{next.label}</Button>}
                  </li>)
              })}</ul>
            </Card>)
        })}
      </section>

      {showMoney && (
        <section aria-labelledby="money" className="mt-10">
          <h2 id="money" className="mb-3 text-xl font-bold">Last 7 days</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Orders" value={m.orders} />
            <Stat label="Money collected" value={formatGHS(m.netCollected)} hint="Paid minus refunds. Not profit." />
            <Stat label="Average order" value={formatGHS(m.avgOrderValue)} hint="Paid orders only" />
          </div>
          <p className="mt-2 text-sm"><Link to="/admin/analytics" className="font-semibold text-brand-700 underline">See full reports</Link></p>
        </section>
      )}
    </>
  )
}
