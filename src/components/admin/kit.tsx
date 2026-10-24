import { createContext, useContext, type ReactNode } from 'react'
import { Download } from 'lucide-react'
import { Button } from '../ui/ui'

/** Inside the Setup tabs the page title becomes a smaller section heading. */
export const EmbeddedContext = createContext(false)

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  const embedded = useContext(EmbeddedContext)
  const H = embedded ? 'h2' : 'h1'
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><H className={embedded ? 'text-xl font-extrabold' : 'text-3xl font-extrabold'}>{title}</H>{sub && <p className="mt-1 text-sm text-ink-500">{sub}</p>}</div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  )
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: 'warn' }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-card ${tone === 'warn' ? 'border-brand-500' : 'border-line'}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  )
}

export function toCSV(rows: (string | number)[][]): string {
  const esc = (v: string | number) => { let s = String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return rows.map((r) => r.map(esc).join(',')).join('\n')
}
export function downloadFile(name: string, content: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}
export const ExportButton = ({ onClick, label = 'Export CSV' }: { onClick: () => void; label?: string }) => <Button variant="secondary" size="sm" onClick={onClick}><Download size={14} /> {label}</Button>

export const Table = ({ head, children }: { head: string[]; children: ReactNode }) => (
  <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
    <table className="w-full min-w-[640px] text-left text-sm">
      <thead className="border-b border-line bg-brand-50/60 text-xs uppercase tracking-wide text-ink-500"><tr>{head.map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-line">{children}</tbody>
    </table>
  </div>
)

export function readImage(file: File, max = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return reject(new Error('Use a PNG, JPG or WebP image.'))
    if (file.size > 8_000_000) return reject(new Error('Image is larger than 8MB.'))
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      resolve(c.toDataURL('image/jpeg', 0.82)) // resized + re-encoded: also strips metadata
    }
    img.onerror = () => reject(new Error('Could not read that image.'))
    img.src = URL.createObjectURL(file)
  })
}
