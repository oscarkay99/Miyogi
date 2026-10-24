import { useSearchParams } from 'react-router-dom'
import { EmbeddedContext, PageHeader } from '../../components/admin/kit'
import { useTitle } from '../../components/ui/ui'
import Calendar from './Calendar'
import Delivery from './Delivery'
import { Content, Payments, SettingsPage } from './Others'

const TABS = [
  { id: 'times', label: 'Days & times', C: Calendar },
  { id: 'delivery', label: 'Delivery', C: Delivery },
  { id: 'payments', label: 'Payments', C: Payments },
  { id: 'website', label: 'Website', C: Content },
  { id: 'business', label: 'Business & policies', C: SettingsPage },
] as const

export default function Setup() {
  useTitle('Setup')
  const [params, setParams] = useSearchParams()
  const active = TABS.find((t) => t.id === params.get('tab')) ?? TABS[0]
  return (
    <>
      <PageHeader title="Setup" sub="Decide when you deliver, where, and how customers pay. Changes go live straight away." />
      <div role="tablist" aria-label="Setup sections" className="-mx-1 mb-6 flex gap-1 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={t.id === active.id} onClick={() => setParams({ tab: t.id }, { replace: true })}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${t.id === active.id ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink-700 hover:border-brand-500'}`}>{t.label}</button>
        ))}
      </div>
      <div role="tabpanel" aria-label={active.label}><EmbeddedContext.Provider value><active.C /></EmbeddedContext.Provider></div>
    </>
  )
}
