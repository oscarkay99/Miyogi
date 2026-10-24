import { TextArea, TextInput, Card } from '../../components/ui/ui'
import { PageHeader } from '../../components/admin/kit'
import { updateSettings, useDB } from '../../data/store'
import { formatGHS, toCedis, toPesewas } from '../../lib/money'

export default function Delivery() {
  const s = useDB((d) => d.settings.services)
  return (
    <>
      <PageHeader title="Delivery" sub="Customers type their own delivery area. You decide whether you can reach it when you accept the order." />
      <Card className="max-w-2xl space-y-4 p-5">
        <TextInput label="Delivery fee (GHS)" type="number" min="0" step="0.01" defaultValue={toCedis(s.deliveryFee)}
          onChange={(e) => void updateSettings((x) => { x.services.deliveryFee = toPesewas(e.target.value) })}
          hint={`One flat fee for every order. Currently ${s.deliveryFee ? formatGHS(s.deliveryFee) : 'free'}. Customers see it before they place the order.`} />
        <TextArea label="Where you deliver (shown to customers)" rows={3} value={s.areasNote}
          onChange={(e) => void updateSettings((x) => { x.services.areasNote = e.target.value })}
          hint="Optional, e.g. “North Legon and nearby areas”. Shown under the delivery area box at checkout." />
      </Card>
    </>
  )
}
