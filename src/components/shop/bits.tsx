import { CalendarClock, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '../ui/ui'
import { useDates } from '../../features/scheduling/hooks'
import { formatCutoff, formatDateLong } from '../../features/scheduling/engine'
import { useDB } from '../../data/store'
import type { MenuItem } from '../../data/types'

export function FoodImage({ src, alt, className = '' }: { src?: string; alt: string; className?: string }) {
  return <img src={src || '/hero-dish.jpg'} alt={alt} loading="lazy" decoding="async" className={`object-cover ${className}`} />
}
export const itemImage = (i: MenuItem) => i.images[0]

/** Real availability from scheduling settings: never a fabricated "open" state. */
export function AvailabilityPill({ itemIds }: { itemIds?: string[] }) {
  const { next, open, configured } = useDates(itemIds)
  if (!open || !configured) return <Badge color="grey">Pre-orders opening soon</Badge>
  if (!next) return <Badge color="yellow">Fully booked right now</Badge>
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-fresh-50 px-3 py-1 text-xs font-semibold text-[#1f6a39]">
      <span className="h-2 w-2 rounded-full bg-fresh" /> Next delivery: {formatDateLong(next.date)}
    </span>
  )
}

export function CutoffNote() {
  const { next, open, configured } = useDates()
  if (!open || !configured || !next) return null
  return <p className="flex items-center gap-2 text-sm text-ink-700"><CalendarClock size={16} className="text-brand-600" /> Order by {formatCutoff(next.cutoff)} for {formatDateLong(next.date)}.</p>
}

export function Announcement() {
  const a = useDB((d) => d.settings.announcement)
  if (!a.enabled || !a.title) return null
  return (
    <div className="bg-espresso text-cream">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center text-sm">
        <span className="rounded-full bg-spice px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide text-espresso">{a.title}</span>
        <span className="opacity-90">{a.body}</span>
      </div>
    </div>
  )
}

export function WhatsAppCTA({ label = 'Chat on WhatsApp', link, className = '' }: { label?: string; link: string; className?: string }) {
  return (
    <a href={link} target="_blank" rel="noopener noreferrer" className={`inline-flex h-11 items-center justify-center gap-2 rounded-full border-2 border-[#0f7a40] px-5 text-[0.95rem] font-semibold text-[#0b6633] transition hover:bg-[#0f7a40] hover:text-white ${className}`}>
      <MessageCircle size={18} /> {label}
    </a>
  )
}

export function BackLink({ to, children }: { to: string; children: string }) {
  return <Link to={to} className="text-sm font-semibold text-brand-700 hover:underline">← {children}</Link>
}
