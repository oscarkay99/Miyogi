import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarX2, ShoppingBag } from 'lucide-react'
import { Button, Card, EmptyState, TextArea, TextInput, useTitle } from '../../components/ui/ui'
import { WhatsAppCTA } from '../../components/shop/bits'
import { cart, useCart } from '../../data/cart'
import { placeOrder, useFullDB, validateCoupon } from '../../data/store'
import { computeTotals, resolveLine } from '../../features/ordering/pricing'
import { formatCutoff, formatDateShort } from '../../features/scheduling/engine'
import { useDates } from '../../features/scheduling/hooks'
import { formatGHS } from '../../lib/money'
import { normalizeGhPhone } from '../../lib/phone'
import { waLink } from '../../lib/whatsapp'
import type { Coupon, OrderLine, PaymentMethod } from '../../data/types'

const DRAFT = 'ras:checkout:v1'
const blank = { name: '', phone: '', email: '', area: '', address: '', landmark: '', instructions: '', date: '', windowId: '', notes: '', coupon: '', consent: true, payment: '' }
type Form = typeof blank

export default function Checkout() {
  useTitle('Checkout')
  const nav = useNavigate()
  const db = useFullDB()
  const { lines } = useCart()
  const [f, setF] = useState<Form>(() => { try { return { ...blank, ...JSON.parse(sessionStorage.getItem(DRAFT) ?? '{}') } } catch { return blank } })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const set = (k: keyof Form, v: string | boolean) => { setF((p) => ({ ...p, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })) }
  useEffect(() => { try { sessionStorage.setItem(DRAFT, JSON.stringify(f)) } catch { /* ignore */ } }, [f])

  const { dates, open, configured } = useDates(lines.map((l) => l.itemId))
  const resolved = lines.map((l) => resolveLine(db.items.find((i) => i.id === l.itemId), l))
  const good: OrderLine[] = resolved.flatMap((r) => (r.ok ? [r.line] : []))
  const problems = resolved.flatMap((r) => (r.ok ? [] : [r.error]))
  const meals = good.reduce((n, l) => n + l.quantity, 0)

  const { deliveryFee, areasNote } = db.settings.services
  const delivery = { fee: deliveryFee }
  const subtotal = good.reduce((n, l) => n + l.lineTotal, 0)
  const phoneN = normalizeGhPhone(f.phone)
  const [cp, setCp] = useState<{ coupon?: Coupon; error?: string }>({})
  useEffect(() => {
    const code = f.coupon.trim()
    if (!code) { setCp({}); return }
    const t = setTimeout(async () => { const r = await validateCoupon(code, f.phone, subtotal); setCp(r.ok ? { coupon: r.coupon } : { error: r.error }) }, 500)
    return () => clearTimeout(t)
  }, [f.coupon, f.phone, subtotal])
  const coupon = f.coupon.trim() ? cp.coupon : undefined
  const couponProblem = f.coupon.trim() ? cp.error ?? null : null
  const totals = computeTotals(good, delivery, coupon)

  const methods: { id: PaymentMethod; label: string; sub: string }[] = []
  if (db.settings.payments.manual.enabled) methods.push({ id: 'manual', label: 'Mobile money / bank transfer', sub: 'Pay after ordering; your order is confirmed once we verify the payment.' })
  if (db.settings.payments.cod.enabled) methods.push({ id: 'cod', label: 'Pay on delivery', sub: 'Pay when your meal arrives.' })
  const payment = (f.payment || methods[0]?.id || '') as PaymentMethod

  const dateState = dates.find((d) => d.date === f.date)
  const waText = `Hello Rice and Spice! I'd like to order:\n${good.map((l) => `• ${l.quantity} × ${l.name}${l.options.length ? ` (${l.options.map((o) => o.name).join(', ')})` : ''}`).join('\n')}\n${f.date ? `Delivery: ${formatDateShort(f.date)}\n` : ''}${f.area.trim() ? `Area: ${f.area.trim()}\n` : ''}Expected total: ${formatGHS(totals.total)}`

  if (lines.length === 0) return <div className="mx-auto max-w-xl px-4 py-20"><EmptyState icon={<ShoppingBag size={36} />} title="Your cart is empty" body="Add a meal to start your pre-order." action={<Link to="/menu"><Button>Browse the menu</Button></Link>} /></div>

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const r = await placeOrder({
      lines, name: f.name, phone: f.phone, email: f.email, area: f.area, address: f.address, landmark: f.landmark, instructions: f.instructions,
      date: f.date, windowId: f.windowId, notes: f.notes, paymentMethod: payment || 'manual', couponCode: f.coupon, consentWhatsApp: f.consent,
    })
    setBusy(false)
    if (!r.ok) { setErrors(r.fieldErrors ?? {}); setFormErrors(r.errors); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    cart.clear()
    try { sessionStorage.removeItem(DRAFT) } catch { /* ignore */ }
    nav(`/order/${r.token}?new=1`)
  }

  const closed = !open || !configured
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-4xl font-extrabold">Checkout</h1>
      {formErrors.length > 0 && (
        <div role="alert" className="mt-5 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900"><AlertTriangle className="shrink-0" /><ul className="list-inside list-disc text-sm font-medium">{formErrors.map((e) => <li key={e}>{e}</li>)}</ul></div>
      )}
      {problems.length > 0 && <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-900">{problems.map((p) => <p key={p}>{p} Please update your cart.</p>)}</div>}

      <form onSubmit={submit} noValidate className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-8">
          <Card className="p-5 sm:p-6">
            <h2 className="mb-1 text-xl font-bold">1. Delivery date and time</h2>
            {closed ? (
              <EmptyState icon={<CalendarX2 size={32} />} title="Pre-orders are not open right now" body="We aren't taking pre-orders at the moment. Message us on WhatsApp to ask when the next batch opens." action={<WhatsAppCTA link={waLink(db.settings.business.whatsapp, waText)} />} />
            ) : dates.length === 0 ? (
              <p className="mt-2 text-ink-700">No delivery dates are open for these items right now.</p>
            ) : (
              <>
                <p className="mb-4 text-sm text-ink-500">Times are Africa/Accra. The window is the time you request; it is not a guaranteed arrival time.</p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label="Delivery date">
                  {dates.map((d) => (
                    <button type="button" key={d.date} role="radio" aria-checked={f.date === d.date} disabled={!d.available}
                      onClick={() => setF((p) => ({ ...p, date: d.date, windowId: '' }))}
                      className={`rounded-2xl border p-3.5 text-left transition disabled:opacity-50 ${f.date === d.date ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600' : 'border-line bg-white hover:border-brand-500'}`}>
                      <span className="block font-bold">{formatDateShort(d.date)}</span>
                      <span className="block text-xs text-ink-500">{d.available ? `Order by ${formatCutoff(d.cutoff)}` : 'Fully booked'}</span>
                    </button>
                  ))}
                </div>
                {errors.date && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{errors.date}</p>}
                {dateState && (
                  <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label="Delivery window">
                    {dateState.slots.map((s) => (
                      <button type="button" key={s.window.id} role="radio" aria-checked={f.windowId === s.window.id} disabled={!s.available || s.remaining < meals}
                        onClick={() => set('windowId', s.window.id)}
                        className={`rounded-2xl border p-3.5 text-left transition disabled:opacity-50 ${f.windowId === s.window.id ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600' : 'border-line bg-white hover:border-brand-500'}`}>
                        <span className="block font-bold">{s.window.label}</span>
                        <span className="block text-xs text-ink-500">{s.reason === 'full' ? 'Full' : s.reason === 'too_soon' ? 'Too soon to prepare' : s.remaining < meals ? `Only ${s.remaining} left` : `${s.remaining} meals left`}</span>
                      </button>
                    ))}
                  </div>
                )}
                {errors.windowId && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{errors.windowId}</p>}
              </>
            )}
          </Card>

          <Card className="space-y-4 p-5 sm:p-6">
            <h2 className="text-xl font-bold">2. Your details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Full name" autoComplete="name" value={f.name} error={errors.name} onChange={(e) => set('name', e.target.value)} />
              <TextInput label="Phone number" type="tel" inputMode="tel" autoComplete="tel" placeholder="054 755 7772" value={f.phone} error={errors.phone}
                hint={phoneN ? `We'll use ${phoneN.e164} (${phoneN.network})` : undefined} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <TextInput label="Email (optional)" type="email" autoComplete="email" value={f.email} error={errors.email} onChange={(e) => set('email', e.target.value)} />
            <TextInput label="Delivery area" autoComplete="address-level2" placeholder="e.g. North Legon" value={f.area} error={errors.area}
              hint={areasNote || undefined} onChange={(e) => set('area', e.target.value)} />
            <TextArea label="Delivery address" value={f.address} error={errors.address} onChange={(e) => set('address', e.target.value)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Nearby landmark" value={f.landmark} onChange={(e) => set('landmark', e.target.value)} />
              <TextInput label="Delivery instructions" value={f.instructions} onChange={(e) => set('instructions', e.target.value)} />
            </div>
            <TextInput label="Order notes (optional)" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="mb-3 text-xl font-bold">3. Payment</h2>
            {methods.length === 0 ? <p className="rounded-xl bg-brand-50 p-4 text-sm text-ink-700">Online payment isn't switched on yet. Please message us on WhatsApp to place your order.</p> : (
              <div className="space-y-2.5" role="radiogroup" aria-label="Payment method">
                {methods.map((m) => (
                  <button type="button" key={m.id} role="radio" aria-checked={payment === m.id} onClick={() => set('payment', m.id)}
                    className={`w-full rounded-2xl border p-4 text-left ${payment === m.id ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600' : 'border-line bg-white'}`}>
                    <span className="block font-bold">{m.label}</span><span className="text-sm text-ink-500">{m.sub}</span>
                  </button>
                ))}
              </div>
            )}
            <label className="mt-4 flex items-start gap-2.5 text-sm text-ink-700"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#c74408]" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} /> Send me order updates on WhatsApp.</label>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 text-xl font-bold">Order summary</h2>
            <ul className="space-y-3">{good.map((l, i) => (
              <li key={i} className="flex justify-between gap-3 text-sm"><span><b>{l.quantity} ×</b> {l.name}{l.options.length > 0 && <span className="block text-xs text-ink-500">{l.options.map((o) => o.name).join(', ')}</span>}</span><span className="font-semibold">{formatGHS(l.lineTotal)}</span></li>
            ))}</ul>
            <div className="mt-4 flex gap-2">
              <input aria-label="Promo code" className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm uppercase" placeholder="Promo code" value={f.coupon} onChange={(e) => set('coupon', e.target.value)} />
            </div>
            {f.coupon.trim() && <p className={`mt-1 text-xs font-medium ${couponProblem ? 'text-red-700' : 'text-fresh'}`}>{couponProblem ?? 'Code applied.'}</p>}
            <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
              <div className="flex justify-between"><dt>Food subtotal</dt><dd>{formatGHS(totals.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>Delivery</dt><dd>{formatGHS(totals.deliveryFee)}</dd></div>
              {totals.discount > 0 && <div className="flex justify-between text-fresh"><dt>Discount</dt><dd>−{formatGHS(totals.discount)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-3 text-xl font-extrabold"><dt>Total</dt><dd>{formatGHS(totals.total)}</dd></div>
            </dl>
            {f.date && f.windowId && dateState && <p className="mt-3 rounded-xl bg-brand-50 p-3 text-sm"><b>{formatDateShort(f.date)}</b>, {dateState.slots.find((s) => s.window.id === f.windowId)?.window.label} <span className="text-ink-500">(requested window)</span></p>}
            <p className="mt-3 text-xs text-ink-500">No extra fees are added after you place your order. Prices are re-checked when you confirm.</p>
            <Button size="lg" className="mt-4 w-full" type="submit" disabled={busy || closed || methods.length === 0 || problems.length > 0}>{busy ? 'Placing order…' : `Place order · ${formatGHS(totals.total)}`}</Button>
            {db.settings.whatsappAssisted && <WhatsAppCTA className="mt-3 w-full" label="Order via WhatsApp instead" link={waLink(db.settings.business.whatsapp, waText)} />}
          </Card>
        </aside>
      </form>
    </div>
  )
}
