import { useState, type FormEvent } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, LayoutDashboard, LogOut, Menu as MenuIcon, Settings, ShoppingBag, Tag, UtensilsCrossed, Users, X } from 'lucide-react'
import { Logo } from '../brand/Logo'
import { Button, TextInput } from '../ui/ui'
import { login, logout, useAuth, type Role } from '../../data/auth'
import { useDB } from '../../data/store'
import { useNow } from '../../features/scheduling/hooks'

const NAV = [
  { to: '/admin', label: 'Today', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/menu', label: 'Menu', icon: UtensilsCrossed },
  { to: '/admin/setup', label: 'Setup', icon: Settings },
]
const MORE = [
  { to: '/admin/analytics', label: 'Reports', icon: BarChart3 },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/promotions', label: 'Promo codes', icon: Tag },
]

function Gate({ notStaff, email }: { notStaff?: boolean; email?: string }) {
  const [e, setE] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (ev: FormEvent) => { ev.preventDefault(); setBusy(true); setErr((await login(e, p)) ?? ''); setBusy(false) }
  return (
    <div className="grid min-h-dvh place-items-center bg-cream p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-3xl border border-line bg-white p-7 shadow-card">
        <Logo size={64} />
        <h1 className="text-2xl font-extrabold">Staff sign in</h1>
        {notStaff && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800">{email} is signed in but isn't a staff account. Ask the owner to add you.</p>}
        <TextInput label="Email" type="email" autoComplete="username" value={e} onChange={(x) => { setE(x.target.value); setErr('') }} />
        <TextInput label="Password" type="password" autoComplete="current-password" value={p} onChange={(x) => { setP(x.target.value); setErr('') }} error={err} />
        <Button className="w-full" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        {notStaff && <button type="button" className="w-full text-sm font-semibold text-brand-700" onClick={logout}>Use a different account</button>}
      </form>
    </div>
  )
}

const ACCESS: Record<Role, string[]> = {
  owner: ['*'], manager: ['*'],
  kitchen: ['/admin', '/admin/orders'],
  delivery: ['/admin', '/admin/orders'],
}

export default function AdminLayout() {
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const ordering = useDB((d) => d.settings.ordering)
  const pending = useDB((d) => d.orders.filter((o) => o.status === 'awaiting_payment' || o.status === 'awaiting_acceptance').length)
  useNow(30_000)
  if (auth.status === 'loading') return <div className="grid min-h-dvh place-items-center bg-cream"><div className="skeleton h-10 w-40 rounded-full" /></div>
  if (auth.status === 'out') return <Gate />
  if (auth.status === 'nostaff') return <Gate notStaff email={auth.email} />
  const allowed = ACCESS[auth.role!]
  const link = ({ to, label, icon: Icon, end }: { to: string; label: string; icon: typeof Users; end?: boolean }) => (
    <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-ink-700 hover:bg-brand-50'}`}>
      <Icon size={18} /> {label}{label === 'Orders' && pending > 0 && <span className="ml-auto rounded-full bg-spice px-2 text-xs font-bold text-espresso">{pending}</span>}
    </NavLink>
  )
  const full = allowed.includes('*')
  const nav = (
    <nav aria-label="Admin" className="space-y-0.5 p-3">
      {NAV.filter((n) => full || allowed.includes(n.to)).map(link)}
      {full && <><p className="px-3 pt-5 pb-1 text-xs font-bold tracking-wider text-ink-500 uppercase">More</p>{MORE.map(link)}</>}
    </nav>
  )
  return (
    <div className="min-h-dvh bg-[#fbf5ec] lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden self-start overflow-y-auto border-r border-line bg-white lg:sticky lg:top-0 lg:block lg:h-dvh"><div className="p-5"><Logo size={48} /></div>{nav}</aside>
      {open && <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-espresso/50" onClick={() => setOpen(false)} /><aside className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-white"><div className="flex items-center justify-between p-5"><Logo size={46} /><button aria-label="Close menu" onClick={() => setOpen(false)}><X /></button></div>{nav}</aside></div>}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-white/90 px-4 backdrop-blur">
          <button className="lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><MenuIcon /></button>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${ordering.open ? 'bg-fresh-50 text-[#1f6a39]' : 'bg-stone-100 text-stone-700'}`}>
            <span className={`h-2 w-2 rounded-full ${ordering.open ? 'bg-fresh' : 'bg-stone-400'}`} /> Pre-orders {ordering.open ? 'open' : 'paused'}
          </span>
          <div className="flex items-center gap-2"><a href={import.meta.env.BASE_URL} target="_blank" className="text-sm font-semibold text-brand-700 hover:underline">View site ↗</a><span className="hidden text-xs text-ink-500 sm:inline">{auth.email} · {auth.role}</span><button onClick={logout} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-brand-50"><LogOut size={15} /> Sign out</button></div>
        </header>
        <main className="p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  )
}
