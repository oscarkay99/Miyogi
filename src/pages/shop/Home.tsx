import { CalendarCheck, ChevronRight, Clock, Heart, Leaf, MapPin, MessageCircle, ShoppingBag, ShoppingCart, Truck, UtensilsCrossed, Bike } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, useTitle } from '../../components/ui/ui'
import { AvailabilityPill, CutoffNote, FoodImage, itemImage } from '../../components/shop/bits'
import { cart } from '../../data/cart'
import { useDB } from '../../data/store'
import { useDates } from '../../features/scheduling/hooks'
import { formatDateLong } from '../../features/scheduling/engine'
import { formatGHS } from '../../lib/money'
import { waLink } from '../../lib/whatsapp'
import type { MenuItem } from '../../data/types'

function Swoosh() {
  return <svg width="120" height="10" viewBox="0 0 120 10" aria-hidden><path d="M2 7 C30 1 80 1 118 5" fill="none" stroke="#E85B0C" strokeWidth="3.5" strokeLinecap="round" /></svg>
}

function QuickAdd({ item }: { item: MenuItem }) {
  const nav = useNavigate()
  const needsChoice = item.optionGroups.length > 0
  return (
    <Button size="sm" onClick={() => (needsChoice ? nav(`/menu/${item.slug}`) : cart.add({ itemId: item.id, optionIds: [], quantity: 1, note: '' }))}>
      <ShoppingCart size={15} /> {needsChoice ? 'Customise' : 'Add to Cart'}
    </Button>
  )
}

export default function Home() {
  const s = useDB((d) => d.settings)
  const items = useDB((d) => d.items.filter((i) => i.active).sort((a, b) => a.sortOrder - b.sortOrder))
  const { next } = useDates()
  const from = items.length ? Math.min(...items.map((i) => i.price)) : 0
  useTitle('', s.hero.description)
  const wa = waLink(s.business.whatsapp, 'Hello Rice and Spice! I would like to pre-order.')

  return (
    <>
      {/* HERO */}
      <section className="relative isolate overflow-hidden bg-espresso text-white">
        <img src={s.hero.image || '/hero-dish.jpg'} alt="Fried rice with grilled chicken" className="absolute inset-y-0 right-0 -z-10 h-full w-full object-cover md:w-[52%]" style={{ maskImage: 'linear-gradient(to right, transparent 0%, black 38%)', WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 38%)' }} />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-espresso/90 via-espresso/70 to-espresso/30 md:bg-gradient-to-r md:from-espresso md:via-espresso/40 md:to-transparent" />
        <div className="mx-auto max-w-6xl px-4 pt-12 pb-10 md:pt-16 md:pb-12">
          <div className="rise max-w-xl">
            <p className="font-script -rotate-3 text-5xl text-brand-500 sm:text-6xl">{s.hero.script}</p>
            <h1 className="mt-1 text-[3.4rem] leading-[0.95] font-black tracking-tight uppercase sm:text-7xl">{s.hero.headline}</h1>
            <p className="mt-1 text-2xl leading-tight font-extrabold uppercase sm:text-4xl">{s.hero.subheadline}</p>
            <p className="mt-5 max-w-md text-base text-white/90 sm:text-lg">{s.hero.description}</p>
            <p className="mt-4 text-lg font-semibold text-white">{s.business.tagline.replace(/,\s*/, '  •  ')}</p>
            <div className="mt-2"><Swoosh /></div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link to="/menu"><Button size="lg" className="pr-5"><ShoppingBag size={20} /> Order Now <ChevronRight size={18} /></Button></Link>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-13 items-center gap-2 rounded-full border-2 border-white/70 px-6 font-semibold transition hover:bg-white hover:text-espresso"><MessageCircle size={18} /> Chat on WhatsApp</a>
              {from > 0 && <p className="text-white/90">from <b className="text-2xl font-extrabold text-spice">{formatGHS(from)}</b></p>}
            </div>
            <div className="mt-5 space-y-2 text-sm text-white/90"><AvailabilityPill /><div className="[&_p]:text-white/90 [&_svg]:text-spice"><CutoffNote /></div></div>
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-4 text-sm font-semibold">
            {[{ i: Leaf, t: 'Freshly Prepared' }, { i: Heart, t: 'Great Taste' }, { i: Bike, t: 'Pre-Orders Only' }].map(({ i: Icon, t }) => (
              <li key={t} className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full border-2 border-brand-500 text-brand-500"><Icon size={20} /></span>{t}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* MENU */}
      <section id="menu" className="mx-auto max-w-6xl px-4 pt-14">
        <h2 className="text-center text-3xl font-extrabold sm:text-4xl">Our Menu</h2>
        <p className="mt-1 mb-8 text-center text-ink-500">Delicious meals made fresh, just for you.</p>
        <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            {items.map((i) => (
              <Card key={i.id} className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
                <Link to={`/menu/${i.slug}`} className="shrink-0"><FoodImage src={itemImage(i)} alt={i.name} className="h-24 w-28 rounded-xl sm:h-28 sm:w-36" /></Link>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-extrabold"><Link to={`/menu/${i.slug}`}>{i.name}</Link></h3>
                  <p className="mt-1 text-sm text-ink-700">{i.description}</p>
                </div>
                <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:flex-col sm:items-end"><p className="text-2xl font-extrabold text-brand-600">{formatGHS(i.price)}</p><QuickAdd item={i} /></div>
              </Card>
            ))}
            {items.length === 0 && <Card className="p-8 text-center text-ink-500">The menu is being prepared. Check back soon.</Card>}
          </div>
          <aside className="flex flex-col items-center justify-center rounded-2xl bg-[#fff1cf] p-7 text-center">
            <Clock size={44} className="text-brand-500" strokeWidth={1.75} />
            <h3 className="mt-3 text-2xl font-extrabold">Pre-Orders Only!</h3>
            <p className="mt-2 text-ink-700">Kindly place your orders in advance so we can prepare something delicious just for you.</p>
            <div className="mt-4"><AvailabilityPill /></div>
          </aside>
        </div>
      </section>

      {/* INFO CARDS */}
      <section className="mx-auto mt-10 grid max-w-6xl gap-5 px-4 md:grid-cols-3">
        <Card className="flex gap-4 p-5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#0f7a40] text-white"><MessageCircle size={28} /></span>
          <div><h3 className="font-extrabold">Order via WhatsApp</h3><p className="mt-1 text-sm text-ink-700">Prefer to chat? You can also place your order directly on WhatsApp.</p>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-[#0f7a40] px-4 text-sm font-semibold text-white hover:bg-[#0b6633]"><MessageCircle size={16} /> Chat on WhatsApp</a></div>
        </Card>
        <Card className="flex gap-4 p-5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600"><CalendarCheck size={28} /></span>
          <div><h3 className="font-extrabold">Delivery Schedule</h3>
            <p className="mt-1 text-sm text-ink-700">{next ? `Next delivery: ${formatDateLong(next.date)}.` : 'Delivery days are announced when pre-orders open.'}</p>
            <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-brand-600"><MapPin size={15} /> {s.business.location.split(',').slice(0, 2).join(',')}</p></div>
        </Card>
        <Card className="flex gap-4 p-5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600"><Truck size={28} /></span>
          <div><h3 className="font-extrabold">Delivery to Your Door</h3>
            <p className="mt-1 text-sm text-ink-700">{s.services.areasNote || 'We deliver to supported areas. Tell us your area at checkout.'}</p></div>
        </Card>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-16">
        <h2 className="text-center text-3xl font-extrabold sm:text-4xl">How It Works</h2>
        <p className="mt-1 mb-12 text-center text-ink-500">Get your favourite meals in 3 simple steps.</p>
        <div className="grid gap-10 md:grid-cols-3 md:gap-5">
          {[
            { i: UtensilsCrossed, t: 'Choose Your Meal', d: 'Browse the menu and choose what you want.' },
            { i: CalendarCheck, t: 'Schedule Your Delivery', d: 'Select an available delivery day and suitable time window.' },
            { i: Truck, t: 'Enjoy Your Food', d: 'Receive your freshly prepared order at your selected location.' },
          ].map(({ i: Icon, t, d }, n) => (
            <div key={t} className="relative rounded-2xl border border-[#f3dcc3] bg-white px-6 pt-9 pb-7 text-center shadow-card">
              <span className="absolute -top-5 left-1/2 grid h-10 w-10 -translate-x-1/2 place-items-center rounded-full bg-brand-500 text-lg font-extrabold text-white ring-4 ring-cream">{n + 1}</span>
              <Icon size={34} className="mx-auto text-brand-500" strokeWidth={1.75} />
              <h3 className="mt-3 text-lg font-extrabold">{t}</h3><p className="mt-1 text-sm text-ink-700">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
