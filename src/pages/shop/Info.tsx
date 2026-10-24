import { Link, useParams } from 'react-router-dom'
import { MapPin, MessageCircle, Phone } from 'lucide-react'
import { Button, Card, EmptyState, useTitle } from '../../components/ui/ui'
import { WhatsAppCTA } from '../../components/shop/bits'
import { useDB } from '../../data/store'
import { waLink } from '../../lib/whatsapp'

export function About() {
  const s = useDB((d) => d.settings)
  useTitle('About Us', s.about.slice(0, 150))
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-4xl font-extrabold sm:text-5xl">About Rice and Spice</h1>
      <p className="mt-5 text-lg whitespace-pre-line text-ink-700">{s.about}</p>
      {s.faq.length > 0 && <>
        <h2 className="mt-12 mb-4 text-2xl font-bold">Frequently asked questions</h2>
        <div className="space-y-3">{s.faq.map((f) => <details key={f.q} className="rounded-2xl border border-line bg-white p-4"><summary className="cursor-pointer font-bold">{f.q}</summary><p className="mt-2 text-ink-700">{f.a}</p></details>)}</div>
      </>}
    </div>
  )
}

export function Contact() {
  const b = useDB((d) => d.settings.business)
  useTitle('Contact')
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-4xl font-extrabold sm:text-5xl">Contact us</h1>
      <p className="mt-3 text-ink-700">Questions before you order? We're happy to help.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card className="p-5"><Phone className="mb-2 text-brand-600" /><p className="font-bold">Call</p><a className="text-brand-700 underline" href={`tel:+233${b.phone.replace(/^0/, '')}`}>{b.phone}</a></Card>
        <Card className="p-5"><MessageCircle className="mb-2 text-[#0f7a40]" /><p className="font-bold">WhatsApp</p><WhatsAppCTA className="mt-2" link={waLink(b.whatsapp, 'Hello Rice and Spice!')} label="Start a chat" /></Card>
        <Card className="p-5 sm:col-span-2"><MapPin className="mb-2 text-brand-600" /><p className="font-bold">Based in {b.location}</p><p className="text-sm text-ink-700">We are a delivery-focused, pre-order kitchen. This is not a walk-in restaurant.</p></Card>
      </div>
    </div>
  )
}

const TITLES = { privacy: 'Privacy Policy', terms: 'Terms and Conditions', refunds: 'Refund and Cancellation Policy' } as const
export function Policy() {
  const { kind } = useParams<{ kind: keyof typeof TITLES }>()
  const policies = useDB((d) => d.settings.policies)
  const title = (kind && TITLES[kind]) || 'Policy'
  useTitle(title)
  const body = kind ? policies[kind] : ''
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-4xl font-extrabold">{title}</h1>
      {body ? <div className="mt-6 text-ink-700 whitespace-pre-line">{body}</div> : (
        <div className="mt-8"><EmptyState title="This policy is being finalised" body="We will publish it here before we start taking orders. If you have questions in the meantime, please contact us." action={<Link to="/contact"><Button variant="secondary">Contact us</Button></Link>} /></div>
      )}
    </div>
  )
}
