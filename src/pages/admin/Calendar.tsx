import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Card, TextInput, Toggle, useTitle } from '../../components/ui/ui'
import { PageHeader } from '../../components/admin/kit'
import { updateSettings, useDB } from '../../data/store'
import { WEEKDAYS, formatTime } from '../../features/scheduling/engine'
import { uid } from '../../lib/ids'
import type { OrderingConfig } from '../../data/types'

export default function Calendar() {
  useTitle('Pre-Order Calendar')
  const saved = useDB((d) => d.settings.ordering)
  const [c, setC] = useState<OrderingConfig>(structuredClone(saved))
  const [done, setDone] = useState(false)
  const [blackout, setBlackout] = useState('')
  const patch = (p: Partial<OrderingConfig>) => { setC({ ...c, ...p }); setDone(false) }
  const num = (v: string) => Math.max(0, Number(v) || 0)
  const bad = c.windows.find((w) => w.start >= w.end)

  return (
    <>
      <PageHeader title="Days & times" sub="All times are Africa/Accra. Nothing here is a fixed rule; change it any time." actions={<Button disabled={!!bad} onClick={async () => { await updateSettings((s) => { s.ordering = c }, true); setDone(true) }}>{done ? 'Saved ✓' : 'Save changes'}</Button>} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <Toggle label="Pre-orders are open to customers" checked={c.open} onChange={(v) => patch({ open: v })} />
          <p className="text-xs text-ink-500">Switch off to pause orders instantly (the site shows “opening soon”).</p>
          <div><p className="mb-2 text-sm font-bold">Delivery days</p>
            <div className="flex flex-wrap gap-2">{WEEKDAYS.map((n, i) => {
              const on = c.deliveryWeekdays.includes(i)
              return <button key={n} type="button" aria-pressed={on} onClick={() => patch({ deliveryWeekdays: on ? c.deliveryWeekdays.filter((x) => x !== i) : [...c.deliveryWeekdays, i].sort() })} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white'}`}>{n.slice(0, 3)}</button>
            })}</div></div>
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Order cut-off time" type="time" value={c.cutoffTime} onChange={(e) => patch({ cutoffTime: e.target.value })} />
            <TextInput label="Cut-off days before" type="number" min="0" value={c.cutoffDaysBefore} onChange={(e) => patch({ cutoffDaysBefore: num(e.target.value) })} hint="1 = the day before delivery" />
            <TextInput label="Minimum notice (hours)" type="number" min="0" value={c.minNoticeHours} onChange={(e) => patch({ minNoticeHours: num(e.target.value) })} />
            <TextInput label="Book up to (days ahead)" type="number" min="1" value={c.maxHorizonDays} onChange={(e) => patch({ maxHorizonDays: num(e.target.value) })} />
          </div>
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Delivery windows</h2><Button size="sm" variant="secondary" onClick={() => patch({ windows: [...c.windows, { id: uid('w_'), label: '', start: '12:00', end: '14:00', capacity: 10 }] })}><Plus size={14} /> Add</Button></div>
          {c.windows.length === 0 && <p className="text-sm text-ink-500">No windows yet. Add at least one for customers to book.</p>}
          <div className="space-y-3">{c.windows.map((w, i) => {
            const up = (p: Partial<typeof w>) => { const n = [...c.windows]; n[i] = { ...w, ...p }; if (p.start || p.end) n[i].label = `${formatTime(n[i].start)} – ${formatTime(n[i].end)}`; patch({ windows: n }) }
            return (
              <div key={w.id} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_5rem_auto]">
                <TextInput label="From" type="time" value={w.start} onChange={(e) => up({ start: e.target.value })} />
                <TextInput label="To" type="time" value={w.end} onChange={(e) => up({ end: e.target.value })} error={w.start >= w.end ? 'End after start' : undefined} />
                <TextInput label="Meals" type="number" min="0" value={w.capacity} onChange={(e) => up({ capacity: num(e.target.value) })} />
                <button aria-label="Remove window" className="mb-2 p-2 text-stone-500 hover:text-red-700" onClick={() => patch({ windows: c.windows.filter((x) => x.id !== w.id) })}><Trash2 size={16} /></button>
              </div>)
          })}</div>
          <p className="mt-2 text-xs text-ink-500">Removing a window won't cancel orders already placed in it.</p>
          <h2 className="mt-6 mb-2 font-bold">Blackout dates & holidays</h2>
          <div className="flex gap-2"><input aria-label="Blackout date" type="date" className="rounded-xl border border-line px-3 py-2" value={blackout} onChange={(e) => setBlackout(e.target.value)} /><Button variant="secondary" size="sm" onClick={() => blackout && !c.blackoutDates.includes(blackout) && (patch({ blackoutDates: [...c.blackoutDates, blackout].sort() }), setBlackout(''))}>Add</Button></div>
          <div className="mt-2 flex flex-wrap gap-2">{c.blackoutDates.map((d) => <button key={d} className="rounded-full bg-stone-100 px-3 py-1 text-sm" onClick={() => patch({ blackoutDates: c.blackoutDates.filter((x) => x !== d) })}>{d} ✕</button>)}</div>
        </Card>
      </div>
    </>
  )
}
