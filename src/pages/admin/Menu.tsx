import { useState } from 'react'
import { ImagePlus, Plus, Trash2 } from 'lucide-react'
import { Badge, Button, Card, Modal, Select, TextArea, TextInput, Toggle, useTitle } from '../../components/ui/ui'
import { PageHeader, readImage } from '../../components/admin/kit'
import { FoodImage } from '../../components/shop/bits'
import { saveCategory, saveItem, useFullDB } from '../../data/store'
import { WEEKDAYS } from '../../features/scheduling/engine'
import { slugify, uid } from '../../lib/ids'
import { formatGHS, toCedis, toPesewas } from '../../lib/money'
import type { MenuItem } from '../../data/types'

const blank = (categoryId: string): MenuItem => ({ id: uid('item_'), slug: '', name: '', description: '', categoryId, price: 0, images: [], active: false, featured: false, sortOrder: 99, availableWeekdays: [], allergens: '', dietary: '', optionGroups: [], createdAt: new Date().toISOString(), updatedAt: '' })

export default function MenuAdmin() {
  useTitle('Menu')
  const db = useFullDB()
  const [edit, setEdit] = useState<MenuItem | null>(null)
  const [catName, setCatName] = useState('')
  return (
    <>
      <PageHeader title="Menu" sub="New items start hidden until you switch them on. Past orders keep the names and prices they were bought at." actions={<Button onClick={() => setEdit(blank(db.categories[0]?.id ?? ''))}><Plus size={16} /> Add item</Button>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {db.items.sort((a, b) => a.sortOrder - b.sortOrder).map((i) => (
          <Card key={i.id} className="flex gap-3 p-3">
            <FoodImage src={i.images[0]} alt="" className="h-24 w-24 shrink-0 rounded-xl bg-brand-50" />
            <div className="min-w-0 flex-1"><p className="font-bold leading-tight">{i.name || 'Untitled'}</p><p className="text-sm font-semibold">{formatGHS(i.price)}</p>
              <div className="mt-1 flex gap-1.5">{i.active ? <Badge color="green">Live</Badge> : <Badge>Hidden</Badge>}{i.featured && <Badge color="orange">Featured</Badge>}</div>
              <div className="mt-2 flex gap-3 text-sm font-semibold text-brand-700"><button onClick={() => setEdit(structuredClone(i))}>Edit</button><button onClick={() => void saveItem({ ...i, active: !i.active })}>{i.active ? 'Hide' : 'Show'}</button></div></div>
          </Card>
        ))}
      </div>
      <h2 className="mt-10 mb-3 text-xl font-bold">Categories</h2>
      <Card className="p-4"><ul className="divide-y divide-line">{db.categories.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-3 py-2"><input aria-label="Category name" className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 font-semibold hover:border-line" defaultValue={c.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.name && void saveCategory({ ...c, name: e.target.value.trim() })} />
          <Toggle label="Visible" checked={c.active} onChange={(v) => void saveCategory({ ...c, active: v })} /></li>))}</ul>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (catName.trim()) { void saveCategory({ id: uid('cat_'), name: catName.trim(), sortOrder: db.categories.length + 1, active: true }); setCatName('') } }}>
          <input aria-label="New category" className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2" placeholder="New category, e.g. Drinks" value={catName} onChange={(e) => setCatName(e.target.value)} /><Button size="sm" variant="secondary" type="submit">Add</Button></form>
        <p className="mt-2 text-xs text-ink-500">Categories with no live items stay hidden from customers.</p></Card>
      {edit && <ItemEditor item={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function ItemEditor({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const db = useFullDB()
  const [i, setI] = useState(item)
  const [price, setPrice] = useState(toCedis(item.price))
  const [err, setErr] = useState('')
  const isNew = !db.items.some((x) => x.id === item.id)
  const p = (patch: Partial<MenuItem>) => setI((x) => ({ ...x, ...patch }))
  const save = async () => {
    if (!i.name.trim()) return setErr('Give the item a name.')
    if (!i.categoryId) return setErr('Create a category first.')
    const slug = slugify(i.slug || i.name)
    if (db.items.some((x) => x.slug === slug && x.id !== i.id)) return setErr('Another item already uses that web address.')
    for (const g of i.optionGroups) if (!g.name.trim() || g.options.some((o) => !o.name.trim())) return setErr('Every option group and option needs a name.')
    const out = { ...i, slug, name: i.name.trim(), price: toPesewas(price), updatedAt: new Date().toISOString() }
    const r = await saveItem(out)
    if (!r.ok) return setErr(r.error)
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={isNew ? 'Add item' : 'Edit item'} wide>
      <div className="space-y-4">
        {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800">{err}</p>}
        <TextInput label="Name" value={i.name} onChange={(e) => p({ name: e.target.value })} />
        <TextArea label="Description" value={i.description} onChange={(e) => p({ description: e.target.value })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Category" value={i.categoryId} onChange={(e) => p({ categoryId: e.target.value })}>{db.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <TextInput label="Price (GHS)" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          <TextInput label="Daily production limit (optional)" type="number" min="0" value={i.dailyLimit ?? ''} onChange={(e) => p({ dailyLimit: e.target.value === '' ? undefined : Number(e.target.value) })} hint="Meals of this item per delivery day" />
          <TextInput label="Sort order" type="number" value={i.sortOrder} onChange={(e) => p({ sortOrder: Number(e.target.value) })} />
          <TextInput label="Allergen information" value={i.allergens} onChange={(e) => p({ allergens: e.target.value })} hint="Only what you can state accurately" />
          <TextInput label="Dietary information" value={i.dietary} onChange={(e) => p({ dietary: e.target.value })} />
        </div>
        <div><p className="mb-1.5 text-sm font-semibold text-ink-700">Only deliverable on (none selected = any delivery day)</p>
          <div className="flex flex-wrap gap-2">{WEEKDAYS.map((n, d) => { const on = i.availableWeekdays.includes(d); return <button key={n} type="button" aria-pressed={on} className={`rounded-full border px-3 py-1 text-sm font-semibold ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-line'}`} onClick={() => p({ availableWeekdays: on ? i.availableWeekdays.filter((x) => x !== d) : [...i.availableWeekdays, d] })}>{n.slice(0, 3)}</button> })}</div></div>
        <div><p className="mb-1.5 text-sm font-semibold text-ink-700">Photos</p>
          <div className="flex flex-wrap gap-2">{i.images.map((s, k) => <div key={k} className="relative"><img src={s} alt="" className="h-20 w-20 rounded-xl object-cover" /><button aria-label="Remove photo" className="absolute -top-1.5 -right-1.5 rounded-full bg-espresso p-1 text-white" onClick={() => p({ images: i.images.filter((_, j) => j !== k) })}><Trash2 size={12} /></button></div>)}
            <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-ink-500 hover:border-brand-500"><ImagePlus /><input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { p({ images: [...i.images, await readImage(f)] }) } catch (x) { setErr((x as Error).message) } e.target.value = '' }} /></label></div></div>

        <div><div className="mb-2 flex items-center justify-between"><p className="text-sm font-bold">Customisation options</p>
          <Button size="sm" variant="secondary" onClick={() => p({ optionGroups: [...i.optionGroups, { id: uid('g_'), name: '', required: false, multiple: false, options: [] }] })}><Plus size={14} /> Option group</Button></div>
          <p className="mb-2 text-xs text-ink-500">Customers only see groups you create here (e.g. “Portion size”, “Extras”). Set prices yourself.</p>
          {i.optionGroups.map((g, gi) => {
            const up = (patch: Partial<typeof g>) => { const n = [...i.optionGroups]; n[gi] = { ...g, ...patch }; p({ optionGroups: n }) }
            return (
              <div key={g.id} className="mb-3 rounded-xl border border-line p-3">
                <div className="flex items-end gap-2"><div className="flex-1"><TextInput label="Group name" value={g.name} onChange={(e) => up({ name: e.target.value })} /></div><button aria-label="Remove group" className="mb-2 p-2 text-stone-500 hover:text-red-700" onClick={() => p({ optionGroups: i.optionGroups.filter((x) => x.id !== g.id) })}><Trash2 size={16} /></button></div>
                <div className="my-2 flex flex-wrap gap-5"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={g.required} onChange={(e) => up({ required: e.target.checked })} /> Required</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={g.multiple} onChange={(e) => up({ multiple: e.target.checked })} /> Allow several</label></div>
                {g.options.map((o, oi) => (
                  <div key={o.id} className="mb-2 grid grid-cols-[1fr_7rem_auto] items-end gap-2">
                    <TextInput label="Option" value={o.name} onChange={(e) => { const n = [...g.options]; n[oi] = { ...o, name: e.target.value }; up({ options: n }) }} />
                    <TextInput label="Extra GHS" type="number" min="0" step="0.01" value={toCedis(o.priceDelta)} onChange={(e) => { const n = [...g.options]; n[oi] = { ...o, priceDelta: toPesewas(e.target.value) }; up({ options: n }) }} />
                    <button aria-label="Remove option" className="mb-2 p-2 text-stone-500 hover:text-red-700" onClick={() => up({ options: g.options.filter((x) => x.id !== o.id) })}><Trash2 size={16} /></button>
                  </div>))}
                <Button size="sm" variant="ghost" onClick={() => up({ options: [...g.options, { id: uid('o_'), name: '', priceDelta: 0 }] })}><Plus size={14} /> Option</Button>
              </div>)
          })}</div>
        <div className="flex flex-wrap gap-6"><Toggle label="Live on website" checked={i.active} onChange={(v) => p({ active: v })} /><Toggle label="Featured on homepage" checked={i.featured} onChange={(v) => p({ featured: v })} /></div>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save item</Button></div>
      </div>
    </Modal>
  )
}
