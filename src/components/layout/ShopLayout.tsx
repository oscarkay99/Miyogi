import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Menu, MessageCircle, Minus, Phone, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import { Logo } from '../brand/Logo'
import { Button } from '../ui/ui'
import { Announcement, FoodImage, itemImage } from '../shop/bits'
import { cart, useCart } from '../../data/cart'
import { useDB } from '../../data/store'
import { resolveLine } from '../../features/ordering/pricing'
import { formatGHS } from '../../lib/money'
import { waLink } from '../../lib/whatsapp'
import { useEffect } from 'react'

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/menu', label: 'Menu' },
  { to: `${import.meta.env.BASE_URL}#how-it-works`, label: 'How to Order', hash: true },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

function Header() {
  const b = useDB((d) => d.settings.business)
  const [open, setOpen] = useState(false)
  const { lines } = useCart()
  const count = lines.reduce((n, l) => n + l.quantity, 0)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])
  return (
    <header className="sticky top-0 z-40 bg-white shadow-[0_2px_16px_-8px_rgb(36_20_15/0.25)]">
      <div className="mx-auto flex h-[5rem] max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/" aria-label="Rice and Spice home"><Logo size={72} /></Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => n.hash
            ? <a key={n.label} href={n.to} className="px-3.5 py-2 text-sm font-semibold text-ink-700 hover:text-brand-600">{n.label}</a>
            : <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `relative px-3.5 py-2 text-sm font-semibold hover:text-brand-600 ${isActive ? 'text-espresso after:absolute after:inset-x-3.5 after:-bottom-[1.4rem] after:h-[3px] after:rounded-full after:bg-brand-500' : 'text-ink-700'}`}>{n.label}</NavLink>)}
        </nav>
        <div className="flex items-center gap-3">
          <a href={`tel:${b.phone}`} className="hidden items-center gap-2 text-sm font-bold lg:flex"><Phone size={16} className="text-brand-600" /> {b.phone.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3')}</a>
          <button onClick={() => cart.open(true)} aria-label={`Open cart, ${count} items`} className="relative rounded-full p-2.5 hover:bg-brand-50">
            <ShoppingBag size={20} />
            {count > 0 && <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[0.7rem] font-bold text-white">{count}</span>}
          </button>
          <Link to="/menu" className="hidden sm:block"><Button size="sm">Order Now</Button></Link>
          <button className="rounded-full p-2.5 hover:bg-brand-50 md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <nav aria-label="Mobile" className="rise border-t border-line bg-cream px-4 pb-4 md:hidden">
          {NAV.map((n) => <Link key={n.label} to={n.to} className="block border-b border-line/60 py-3 font-semibold">{n.label}</Link>)}
          <Link to="/menu"><Button className="mt-4 w-full">Order Now</Button></Link>
        </nav>
      )}
    </header>
  )
}

function CartDrawer() {
  const { lines, open } = useCart()
  const items = useDB((d) => d.items)
  const resolved = lines.map((l) => ({ l, r: resolveLine(items.find((i) => i.id === l.itemId), l), item: items.find((i) => i.id === l.itemId) }))
  const subtotal = resolved.reduce((n, x) => n + (x.r.ok ? x.r.line.lineTotal : 0), 0)
  const blocked = resolved.some((x) => !x.r.ok)
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && cart.open(false)
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60]" onMouseDown={(e) => e.target === e.currentTarget && cart.open(false)}>
      <div className="absolute inset-0 bg-espresso/50" aria-hidden onClick={() => cart.open(false)} />
      <aside role="dialog" aria-modal="true" aria-label="Your cart" className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-cream shadow-2xl" style={{ animation: 'rise .25s both' }}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-xl font-bold">Your cart</h2>
          <button onClick={() => cart.open(false)} aria-label="Close cart" className="rounded-full p-2 hover:bg-white"><X size={20} /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {resolved.length === 0 && (
            <div className="grid h-full place-items-center text-center">
              <div><ShoppingBag className="mx-auto mb-3 text-brand-500" size={40} /><p className="font-bold">Your cart is empty</p><p className="mb-4 text-sm text-ink-500">Pick something delicious to pre-order.</p>
                <Link to="/menu" onClick={() => cart.open(false)}><Button>Browse the menu</Button></Link></div>
            </div>
          )}
          {resolved.map(({ l, r, item }) => (
            <div key={l.key} className="flex gap-3 rounded-2xl border border-line bg-white p-3">
              <FoodImage src={item && itemImage(item)} alt="" className="h-20 w-20 shrink-0 rounded-xl bg-brand-50" />
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight">{item?.name ?? 'Unavailable item'}</p>
                {r.ok && r.line.options.length > 0 && <p className="text-xs text-ink-500">{r.line.options.map((o) => o.name).join(', ')}</p>}
                {l.note && <p className="text-xs text-ink-500 italic">“{l.note}”</p>}
                {!r.ok && <p className="text-sm font-medium text-red-700">{r.error}</p>}
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1 rounded-full border border-line">
                    <button className="p-2" aria-label="Decrease quantity" onClick={() => cart.setQty(l.key, l.quantity - 1)}><Minus size={14} /></button>
                    <span className="w-6 text-center text-sm font-bold" aria-live="polite">{l.quantity}</span>
                    <button className="p-2" aria-label="Increase quantity" onClick={() => cart.setQty(l.key, l.quantity + 1)}><Plus size={14} /></button>
                  </div>
                  <span className="font-bold">{r.ok ? formatGHS(r.line.lineTotal) : '—'}</span>
                  <button className="p-2 text-stone-500 hover:text-red-700" aria-label="Remove" onClick={() => cart.remove(l.key)}><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {resolved.length > 0 && (
          <div className="border-t border-line bg-white p-5">
            <div className="mb-1 flex justify-between font-semibold"><span>Food subtotal</span><span>{formatGHS(subtotal)}</span></div>
            <p className="mb-4 text-xs text-ink-500">Delivery fee and promo codes are applied at checkout, before you confirm.</p>
            <Link to="/checkout" onClick={() => cart.open(false)}><Button size="lg" className="w-full" disabled={blocked}>Continue to checkout</Button></Link>
          </div>
        )}
      </aside>
    </div>
  )
}

function Footer() {
  const s = useDB((d) => d.settings)
  const b = s.business
  const socials = Object.entries(s.social).filter(([, v]) => v)
  return (
    <footer className="mt-24 bg-espresso text-cream">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-4">
        <div className="md:col-span-1"><Logo tone="light" size={170} tagline /></div>
        <div><h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-spice">Quick links</h3>
          <ul className="space-y-2 text-sm opacity-90"><li><Link to="/menu">Menu</Link></li><li><Link to="/about">About Us</Link></li><li><Link to="/track">Track an order</Link></li><li><Link to="/contact">Contact</Link></li></ul></div>
        <div><h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-spice">Get in touch</h3>
          <ul className="space-y-2 text-sm opacity-90">
            <li><a className="inline-flex items-center gap-2" href={`tel:+233${b.phone.replace(/^0/, '')}`}><Phone size={14} /> {b.phone}</a></li>
            <li><a className="inline-flex items-center gap-2" href={waLink(b.whatsapp)} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> WhatsApp</a></li>
            <li>{b.location}</li>
            {socials.map(([k, v]) => <li key={k}><a href={v} target="_blank" rel="noopener noreferrer" className="capitalize">{k}</a></li>)}
          </ul></div>
        <div><h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-spice">Service</h3>
          <p className="text-sm opacity-90">{s.services.delivery ? 'Delivery to supported areas, by pre-order.' : ''}{s.services.pickup ? ' Pickup available.' : ''}</p>
          <ul className="mt-3 space-y-2 text-sm opacity-90"><li><Link to="/policies/privacy">Privacy Policy</Link></li><li><Link to="/policies/terms">Terms and Conditions</Link></li><li><Link to="/policies/refunds">Refund and Cancellation</Link></li></ul></div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs opacity-70">© {new Date().getFullYear()} {b.name}. {b.tagline}. · <Link to="/admin" className="underline-offset-2 hover:underline">Staff</Link></div>
    </footer>
  )
}

function WhatsAppFloat() {
  const wa = useDB((d) => d.settings.business.whatsapp)
  return (
    <a href={waLink(wa, 'Hello Rice and Spice! I have a question.')} target="_blank" rel="noopener noreferrer" aria-label="Chat with Rice and Spice on WhatsApp"
      className="fixed right-4 bottom-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-[#0f7a40] text-white shadow-[0_10px_30px_-8px_rgb(18_140_74/0.8)] transition hover:scale-105">
      <MessageCircle size={26} />
    </a>
  )
}

export function ShopLayout() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">Skip to content</a>
      <Announcement />
      <Header />
      <main id="main"><Outlet /></main>
      <Footer />
      <WhatsAppFloat />
      <CartDrawer />
    </>
  )
}
