import { useState } from 'react'
import { Check, Minus, Plus } from 'lucide-react'
import { Button, TextInput } from '../ui/ui'
import { cart } from '../../data/cart'
import { resolveLine } from '../../features/ordering/pricing'
import { formatGHS } from '../../lib/money'
import type { MenuItem } from '../../data/types'
import { useNavigate } from 'react-router-dom'

/** Option selection + quantity + note; only renders option groups the owner configured. */
export function Configurator({ item }: { item: MenuItem }) {
  const nav = useNavigate()
  const [picked, setPicked] = useState<string[]>(() => item.optionGroups.flatMap((g) => (g.required && !g.multiple && g.options[0] ? [] : [])))
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [added, setAdded] = useState(false)

  const toggle = (gid: string, oid: string, multiple: boolean) => {
    const g = item.optionGroups.find((x) => x.id === gid)!
    const ids = g.options.map((o) => o.id)
    setPicked((p) => (multiple ? (p.includes(oid) ? p.filter((x) => x !== oid) : [...p, oid]) : [...p.filter((x) => !ids.includes(x)), oid]))
    setError('')
  }
  const r = resolveLine(item, { itemId: item.id, optionIds: picked, quantity: qty, note })
  const total = r.ok ? r.line.lineTotal : (item.price + item.optionGroups.flatMap((g) => g.options).filter((o) => picked.includes(o.id)).reduce((n, o) => n + o.priceDelta, 0)) * qty

  const add = (goCheckout: boolean) => {
    if (!r.ok) return setError(r.error)
    cart.add({ itemId: item.id, optionIds: picked, quantity: qty, note })
    if (goCheckout) { cart.open(false); nav('/checkout') } else { setAdded(true); setTimeout(() => setAdded(false), 1800) }
  }

  return (
    <div className="space-y-5">
      {item.optionGroups.map((g) => (
        <fieldset key={g.id}>
          <legend className="mb-2 text-sm font-bold">{g.name} <span className="font-medium text-ink-500">{g.required ? '(required)' : '(optional)'}</span></legend>
          <div className="grid gap-2">
            {g.options.map((o) => {
              const on = picked.includes(o.id)
              return (
                <button type="button" key={o.id} role={g.multiple ? 'checkbox' : 'radio'} aria-checked={on} onClick={() => toggle(g.id, o.id, g.multiple)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${on ? 'border-brand-600 bg-brand-50' : 'border-line bg-white hover:border-brand-500'}`}>
                  <span className="flex items-center gap-2"><span className={`grid h-5 w-5 place-items-center border-2 ${g.multiple ? 'rounded-md' : 'rounded-full'} ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300'}`}>{on && <Check size={12} />}</span>{o.name}</span>
                  <span className="text-ink-500">{o.priceDelta ? `+${formatGHS(o.priceDelta)}` : 'Included'}</span>
                </button>
              )
            })}
          </div>
        </fieldset>
      ))}
      <TextInput label="Special preparation notes (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. less pepper" />
      <div className="flex items-center gap-4">
        <div className="flex items-center rounded-full border border-line bg-white">
          <button className="p-3" aria-label="Decrease quantity" onClick={() => setQty(Math.max(1, qty - 1))}><Minus size={16} /></button>
          <span className="w-8 text-center font-bold" aria-live="polite">{qty}</span>
          <button className="p-3" aria-label="Increase quantity" onClick={() => setQty(Math.min(50, qty + 1))}><Plus size={16} /></button>
        </div>
        <p className="text-2xl font-extrabold">{formatGHS(total)}</p>
      </div>
      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={() => add(false)} className="flex-1">{added ? <><Check size={18} /> Added</> : 'Add to Cart'}</Button>
        <Button size="lg" variant="dark" onClick={() => add(true)} className="flex-1">Pre-Order Now</Button>
      </div>
    </div>
  )
}
