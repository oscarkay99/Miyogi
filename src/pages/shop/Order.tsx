import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Circle, Printer, SearchX } from 'lucide-react'
import { Button, Card, EmptyState, PaymentBadge, StatusBadge, TextInput, useTitle } from '../../components/ui/ui'
import { WhatsAppCTA } from '../../components/shop/bits'
import { findOrderToken, useDB, useOrder } from '../../data/store'
import { formatDateLong } from '../../features/scheduling/engine'
import { formatGHS } from '../../lib/money'
import { orderMessage, waLink } from '../../lib/whatsapp'
import type { OrderStatus } from '../../data/types'

const STEPS: { s: OrderStatus[]; label: string }[] = [
  { s: ['awaiting_payment', 'payment_confirmed'], label: 'Order placed' },
  { s: ['awaiting_acceptance'], label: 'Awaiting acceptance' },
  { s: ['accepted'], label: 'Accepted' },
  { s: ['preparing'], label: 'Preparing' },
  { s: ['ready'], label: 'Ready for dispatch' },
  { s: ['out_for_delivery'], label: 'Out for delivery' },
  { s: ['delivered'], label: 'Delivered' },
]

export function OrderPage() {
  const { token } = useParams()
  const [q] = useSearchParams()
  const { order, loading } = useOrder(token)
  const settings = useDB((d) => d.settings)
  useTitle(order ? `Order ${order.reference}` : 'Order not found')
  if (loading) return <div className="mx-auto max-w-3xl px-4 py-10"><div className="skeleton h-96 rounded-3xl" /></div>
  if (!order) return <div className="mx-auto max-w-xl px-4 py-20"><EmptyState icon={<SearchX size={36} />} title="We couldn't find that order" body="Check your tracking link, or look it up with your order reference and phone number." action={<Link to="/track"><Button>Find my order</Button></Link>} /></div>

  const idx = STEPS.findIndex((x) => x.s.includes(order.status))
  const failed = ['cancelled', 'rejected', 'payment_failed', 'refunded', 'partially_refunded'].includes(order.status)
  const wa = waLink(settings.business.whatsapp, orderMessage(order))
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {q.get('new') && !failed && (
        <div className="rise mb-6 rounded-3xl bg-fresh-50 p-6 text-[#14522a]">
          <CheckCircle2 size={32} /><h1 className="mt-2 text-3xl font-extrabold">Thank you, {order.customer.name.split(' ')[0]}!</h1>
          <p className="mt-1">Your pre-order has been received. Save this page, it's your tracking link.</p>
        </div>
      )}
      <Card className="print-area p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-sm font-semibold text-ink-500">Order reference</p><h2 className="text-3xl font-extrabold">{order.reference}</h2></div>
          <div className="flex flex-col items-end gap-1.5"><StatusBadge status={order.status} /><PaymentBadge status={order.paymentStatus} /></div>
        </div>

        {order.status === 'awaiting_payment' && (
          <div className="mt-5 rounded-2xl bg-[#fff4cc] p-4 text-sm text-[#5d4500]">
            <b>Payment awaiting verification.</b> {settings.payments.manual.instructions || 'Please pay using the instructions we shared, then contact us.'} Use <b>{order.reference}</b> as your reference. Your slot is held for a limited time; it's confirmed once we verify your payment.
          </div>
        )}
        {order.paymentMethod === 'cod' && order.status !== 'delivered' && !failed && <p className="mt-5 rounded-2xl bg-brand-50 p-4 text-sm">Pay <b>{formatGHS(order.total)}</b> on delivery.</p>}

        {!failed ? (
          <ol className="my-7 space-y-3" aria-label="Order progress">
            {STEPS.map((st, i) => (
              <li key={st.label} className={`flex items-center gap-3 ${i <= idx ? 'font-bold' : 'text-ink-500'}`}>
                {i <= idx ? <CheckCircle2 className="text-fresh" size={20} /> : <Circle size={20} className="text-stone-300" />}{st.label}
              </li>
            ))}
          </ol>
        ) : <p className="my-6 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-900">This order is {order.status.replace('_', ' ')}.{order.refundDue ? ' A refund is being arranged; we will contact you.' : ''}</p>}

        <div className="grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
          <div><h3 className="mb-1 text-sm font-bold text-ink-500">Requested delivery</h3><p className="font-semibold">{formatDateLong(order.delivery.date)}</p><p>{order.delivery.windowLabel}</p><p className="text-xs text-ink-500">This is the window you requested, not a guaranteed arrival time.</p></div>
          <div><h3 className="mb-1 text-sm font-bold text-ink-500">Deliver to</h3><p>{order.delivery.zoneName}</p><p className="text-sm text-ink-700">{order.delivery.address}</p></div>
        </div>
        <ul className="mt-5 divide-y divide-line border-t border-line">
          {order.lines.map((l, i) => <li key={i} className="flex justify-between py-3 text-sm"><span><b>{l.quantity} ×</b> {l.name}{l.options.length > 0 && <span className="block text-xs text-ink-500">{l.options.map((o) => o.name).join(', ')}</span>}{l.note && <span className="block text-xs italic text-ink-500">“{l.note}”</span>}</span><span className="font-semibold">{formatGHS(l.lineTotal)}</span></li>)}
        </ul>
        <dl className="space-y-1 border-t border-line pt-4 text-sm">
          <div className="flex justify-between"><dt>Food subtotal</dt><dd>{formatGHS(order.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>Delivery</dt><dd>{formatGHS(order.deliveryFee)}</dd></div>
          {order.discount > 0 && <div className="flex justify-between text-fresh"><dt>Discount {order.couponCode && `(${order.couponCode})`}</dt><dd>−{formatGHS(order.discount)}</dd></div>}
          <div className="flex justify-between pt-2 text-lg font-extrabold"><dt>Total</dt><dd>{formatGHS(order.total)}</dd></div>
        </dl>
      </Card>
      <div className="mt-5 flex flex-wrap gap-3">
        <WhatsAppCTA link={wa} label="Message us about this order" />
        <Button variant="secondary" onClick={() => window.print()}><Printer size={16} /> Print receipt</Button>
      </div>
    </div>
  )
}

export function TrackLookup() {
  useTitle('Track your order')
  const nav = useNavigate()
  const [ref, setRef] = useState('')
  const [phone, setPhone] = useState('')
  const [err, setErr] = useState('')
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-4xl font-extrabold">Track your order</h1>
      <p className="mt-2 mb-6 text-ink-700">Enter your order reference and the phone number you ordered with.</p>
      <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); const t = await findOrderToken(ref, phone); if (t) nav(`/order/${t}`); else setErr('We could not match that reference and phone number.') }}>
        <TextInput label="Order reference" placeholder="RNS-20261021-0001" value={ref} onChange={(e) => { setRef(e.target.value); setErr('') }} />
        <TextInput label="Phone number" type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setErr('') }} error={err} />
        <Button className="w-full" type="submit">Find my order</Button>
      </form>
    </div>
  )
}
