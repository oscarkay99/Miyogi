import { formatGHS } from './money'
import { formatDateLong } from '../features/scheduling/engine'
import type { Order } from '../data/types'

export const waLink = (number: string, text?: string) => `https://wa.me/${number.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`

export function orderMessage(o: Order): string {
  const items = o.lines.map((l) => `• ${l.quantity} × ${l.name}${l.options.length ? ` (${l.options.map((x) => x.name).join(', ')})` : ''}`).join('\n')
  return `Hello Rice and Spice! I have placed order ${o.reference}.\n\n${items}\n\nDelivery: ${formatDateLong(o.delivery.date)}, ${o.delivery.windowLabel}\nArea: ${o.delivery.zoneName}\nTotal: ${formatGHS(o.total)}`
}

export function fillTemplate(t: string, o: Order): string {
  return t.replace('{name}', o.customer.name.split(' ')[0]).replace('{ref}', o.reference).replace('{date}', formatDateLong(o.delivery.date)).replace('{window}', o.delivery.windowLabel)
}
