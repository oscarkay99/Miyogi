import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { Badge, Button, EmptyState, Modal, PaymentBadge, StatusBadge, TextInput, useConfirm, useTitle } from '../../components/ui/ui'
import { ExportButton, PageHeader, Table, downloadFile, toCSV } from '../../components/admin/kit'
import { addInternalNote, assignRider, confirmManualPayment, markPaymentFailed, recordRefund, transitionOrder, useFullDB, type ActionResult } from '../../data/store'
import { NEXT_STEP, STATUS_LABEL, TERMINAL, canTransition } from '../../features/ordering/status'
import { formatDateShort } from '../../features/scheduling/engine'
import { formatGHS, toPesewas } from '../../lib/money'
import { fillTemplate, waLink } from '../../lib/whatsapp'
import type { Order, OrderStatus } from '../../data/types'

const PAGE = 20

export default function Orders() {
  useTitle('Orders')
  const db = useFullDB()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(''); const [view, setView] = useState<'active' | 'done' | 'all'>('active'); const [page, setPage] = useState(0)
  const openId = params.get('open')
  const setOpenId = (id: string | null) => setParams(id ? { open: id } : {}, { replace: true })
  const isDone = (o: Order) => TERMINAL.includes(o.status) || o.status === 'partially_refunded'
  const list = db.orders.filter((o) =>
    (view === 'all' || (view === 'done') === isDone(o)) &&
    (!q || `${o.reference} ${o.customer.name} ${o.customer.phone}`.toLowerCase().includes(q.toLowerCase())))
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const order = db.orders.find((o) => o.id === openId)

  const exportCsv = () => downloadFile('orders.csv', toCSV([
    ['Reference', 'Created', 'Status', 'Payment', 'Customer', 'Phone', 'Delivery date', 'Window', 'Zone', 'Items', 'Subtotal GHS', 'Delivery GHS', 'Discount GHS', 'Total GHS'],
    ...list.map((o) => [o.reference, o.createdAt, o.status, o.paymentStatus, o.customer.name, o.customer.phone, o.delivery.date, o.delivery.windowLabel, o.delivery.zoneName,
      o.lines.map((l) => `${l.quantity}x ${l.name}`).join('; '), o.subtotal / 100, o.deliveryFee / 100, o.discount / 100, o.total / 100]),
  ]))

  return (
    <>
      <PageHeader title="Orders" sub={`${list.length} order${list.length === 1 ? '' : 's'}`} actions={<ExportButton onClick={exportCsv} />} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1"><TextInput label="Search" placeholder="Reference, name or phone" value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} /></div>
        <div role="group" aria-label="Show" className="flex gap-1.5 pb-0.5">
          {([['active', 'Active'], ['done', 'Done'], ['all', 'All']] as const).map(([k, l]) => (
            <button key={k} aria-pressed={view === k} onClick={() => { setView(k); setPage(0) }} className={`rounded-full border px-4 py-2 text-sm font-semibold ${view === k ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink-700'}`}>{l}</button>
          ))}
        </div>
      </div>
      {list.length === 0 ? <EmptyState title={view === 'active' && !q ? 'No active orders' : 'No orders found'} body="Orders placed on the website will appear here." /> : (
        <>
          <Table head={['Reference', 'Customer', 'Delivery', 'Total', 'Status', 'Payment']}>
            {list.slice(page * PAGE, page * PAGE + PAGE).map((o) => (
              <tr key={o.id} className="cursor-pointer hover:bg-brand-50/50" onClick={() => setOpenId(o.id)}>
                <td className="px-4 py-3 font-bold"><button className="text-left text-brand-700 hover:underline" onClick={() => setOpenId(o.id)}>{o.reference}</button></td>
                <td className="px-4 py-3">{o.customer.name}<span className="block text-xs text-ink-500">{o.customer.phone}</span></td>
                <td className="px-4 py-3">{formatDateShort(o.delivery.date)}<span className="block text-xs text-ink-500">{o.delivery.windowLabel}</span></td>
                <td className="px-4 py-3 font-semibold">{formatGHS(o.total)}</td>
                <td className="px-4 py-3"><StatusBadge status={o.status} />{o.refundDue && <Badge color="red">Refund due</Badge>}</td>
                <td className="px-4 py-3"><PaymentBadge status={o.paymentStatus} /></td>
              </tr>
            ))}
          </Table>
          {pages > 1 && <div className="mt-4 flex items-center justify-center gap-3 text-sm"><Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>Page {page + 1} of {pages}<Button size="sm" variant="secondary" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button></div>}
        </>
      )}
      {order && <OrderModal order={order} onClose={() => setOpenId(null)} />}
    </>
  )
}

function OrderModal({ order: o, onClose }: { order: Order; onClose: () => void }) {
  const db = useFullDB()
  const { confirm, node } = useConfirm()
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [rider, setRider] = useState(o.rider?.name ?? ''); const [riderPhone, setRiderPhone] = useState(o.rider?.phone ?? '')
  const [refund, setRefund] = useState(((o.total - o.refunds.reduce((n, r) => n + r.amount, 0)) / 100).toString()); const [refundWhy, setRefundWhy] = useState('')
  const [print, setPrint] = useState<'ticket' | 'receipt' | null>(null)
  const run = async (p: Promise<ActionResult>) => { const r = await p; setErr(r.ok ? '' : r.error) }
  const next = NEXT_STEP[o.status]
  const tpl = db.settings.notificationTemplates[o.status]
  const canRefund = (o.paymentStatus === 'paid' || o.paymentStatus === 'partially_refunded')

  return (
    <Modal open onClose={onClose} title={o.reference} wide>
      {node}
      <div className="flex flex-wrap gap-2"><StatusBadge status={o.status} /><PaymentBadge status={o.paymentStatus} /><Badge>{o.paymentMethod === 'cod' ? 'Pay on delivery' : 'Manual payment'}</Badge>{o.refundDue && <Badge color="red">Refund due</Badge>}</div>
      {err && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800">{err}</p>}

      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div><b>{o.customer.name}</b><br />{o.customer.phone}{o.customer.email && <><br />{o.customer.email}</>}<br /><a className="font-semibold text-brand-700 underline" target="_blank" rel="noopener noreferrer" href={waLink(o.customer.phone, tpl ? fillTemplate(tpl, o) : `Hi ${o.customer.name.split(' ')[0]}, regarding your order ${o.reference}:`)}>Message on WhatsApp</a></div>
        <div><b>{formatDateShort(o.delivery.date)}, {o.delivery.windowLabel}</b><br />{o.delivery.zoneName}<br />{o.delivery.address}{o.delivery.landmark && <><br />Landmark: {o.delivery.landmark}</>}{o.delivery.instructions && <><br />Note: {o.delivery.instructions}</>}</div>
      </div>
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line text-sm">{o.lines.map((l, i) => <li key={i} className="flex justify-between p-3"><span><b>{l.quantity} ×</b> {l.name}{l.options.length > 0 && <span className="block text-xs text-ink-500">{l.options.map((x) => x.name).join(', ')}</span>}{l.note && <span className="block text-xs italic">“{l.note}”</span>}</span><span>{formatGHS(l.lineTotal)}</span></li>)}
        <li className="flex justify-between p-3 text-ink-500"><span>Delivery{o.discount ? ` · discount −${formatGHS(o.discount)}` : ''}</span><span>{formatGHS(o.deliveryFee)}</span></li>
        <li className="flex justify-between p-3 font-extrabold"><span>Total</span><span>{formatGHS(o.total)}</span></li></ul>
      {o.notes && <p className="mt-3 text-sm"><b>Customer note:</b> {o.notes}</p>}

      <div className="mt-5 flex flex-wrap gap-2">
        {o.status === 'awaiting_payment' && <>
          <Button onClick={() => confirm('Confirm payment received?', 'Only confirm after you have seen the money in your account. Screenshots alone are not proof of payment.', () => run(confirmManualPayment(o.id)), 'Payment received')}>Payment verified</Button>
          <Button variant="secondary" onClick={() => confirm('Mark payment as failed?', 'The customer’s slot will be released.', () => run(markPaymentFailed(o.id)), 'Mark failed', true)}>Payment not received</Button>
        </>}
        {next && <Button onClick={() => run(transitionOrder(o.id, next.to))}>{next.label}</Button>}
        {o.status === 'awaiting_acceptance' && <Button variant="danger" onClick={() => confirm('Reject this order?', o.paymentStatus === 'paid' ? 'The customer has paid, so a refund will be flagged.' : 'The customer will be told it was rejected.', () => run(transitionOrder(o.id, 'rejected')), 'Reject order', true)}>Reject</Button>}
        {canTransition(o.status, 'cancelled') && <Button variant="secondary" onClick={() => confirm('Cancel this order?', 'This frees the delivery slot and cannot be undone.', () => run(transitionOrder(o.id, 'cancelled')), 'Cancel order', true)}>Cancel order</Button>}
        <Button variant="ghost" onClick={() => { setPrint('ticket'); setTimeout(() => window.print(), 50) }}><Printer size={15} /> Kitchen ticket</Button>
        <Button variant="ghost" onClick={() => { setPrint('receipt'); setTimeout(() => window.print(), 50) }}><Printer size={15} /> Receipt</Button>
      </div>

      <details className="mt-5 rounded-xl border border-line p-3"><summary className="cursor-pointer text-sm font-bold">More: rider, refunds, notes, history</summary><div className="mt-3">
      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <TextInput label="Rider name" value={rider} onChange={(e) => setRider(e.target.value)} />
        <TextInput label="Rider phone" value={riderPhone} onChange={(e) => setRiderPhone(e.target.value)} />
        <Button className="self-end" variant="secondary" onClick={() => assignRider(o.id, rider.trim(), riderPhone.trim())}>Assign</Button>
      </div>

      {canRefund && (
        <div className="mt-5 rounded-xl border border-line p-3">
          <p className="mb-2 text-sm font-bold">Record a refund <span className="font-medium text-ink-500">(you pay it out manually; no payment provider is connected)</span></p>
          <div className="grid gap-3 sm:grid-cols-[8rem_1fr_auto]"><TextInput label="Amount GHS" type="number" min="0" step="0.01" value={refund} onChange={(e) => setRefund(e.target.value)} /><TextInput label="Reason" value={refundWhy} onChange={(e) => setRefundWhy(e.target.value)} />
            <Button className="self-end" variant="secondary" onClick={() => confirm('Record this refund?', 'Only record it after the money has been sent back to the customer.', () => run(recordRefund(o.id, toPesewas(refund), refundWhy || 'Refund')), 'Record refund', true)}>Record</Button></div>
        </div>
      )}
      {o.refunds.length > 0 && <ul className="mt-2 text-sm text-ink-700">{o.refunds.map((r, i) => <li key={i}>Refunded {formatGHS(r.amount)} — {r.reason}</li>)}</ul>}

      <div className="mt-5"><p className="mb-1 text-sm font-bold">Internal notes</p>
        {o.internalNotes.map((n, i) => <p key={i} className="rounded-lg bg-stone-50 p-2 text-sm">{n.split('|')[1]} <span className="text-xs text-ink-500">· {n.split('|')[0].slice(0, 16).replace('T', ' ')}</span></p>)}
        <div className="mt-2 flex gap-2"><input aria-label="Add internal note" className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm" placeholder="Add a note (staff only)" value={note} onChange={(e) => setNote(e.target.value)} /><Button size="sm" variant="secondary" onClick={() => { if (note.trim()) { addInternalNote(o.id, note.trim()); setNote('') } }}>Add</Button></div></div>
      <details className="mt-4 text-sm"><summary className="cursor-pointer font-bold">History</summary><ul className="mt-2 space-y-1">{o.events.map((e, i) => <li key={i} className="text-ink-700">{e.at.slice(0, 16).replace('T', ' ')} · {STATUS_LABEL[e.status as OrderStatus]} · {e.by}{e.note && ` — ${e.note}`}</li>)}</ul></details>

      </div></details>

      {print && <div className="print-area hidden print:block"><PrintSheet o={o} kind={print} /></div>}
    </Modal>
  )
}

function PrintSheet({ o, kind }: { o: Order; kind: 'ticket' | 'receipt' }) {
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 14 }}>
      <h2 style={{ fontSize: 20 }}>{kind === 'ticket' ? 'KITCHEN TICKET' : 'Rice and Spice — Receipt'}</h2>
      <p>{o.reference}</p><p>Deliver: {o.delivery.date} {o.delivery.windowLabel}</p>
      {kind === 'ticket' && <p>{o.customer.name} · {o.delivery.zoneName}</p>}
      <hr />{o.lines.map((l, i) => <p key={i}>{l.quantity} × {l.name}{l.options.length ? ` [${l.options.map((x) => x.name).join(', ')}]` : ''}{l.note ? ` — ${l.note}` : ''}{kind === 'receipt' ? `  ${formatGHS(l.lineTotal)}` : ''}</p>)}
      {kind === 'receipt' && <><hr /><p>Subtotal {formatGHS(o.subtotal)}</p><p>Delivery {formatGHS(o.deliveryFee)}</p>{o.discount > 0 && <p>Discount −{formatGHS(o.discount)}</p>}<p><b>Total {formatGHS(o.total)}</b></p><p>Payment: {o.paymentStatus}</p></>}
      {o.notes && <p>Note: {o.notes}</p>}
    </div>
  )
}
