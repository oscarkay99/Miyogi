import { useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { X } from 'lucide-react'
import { STATUS_LABEL, PAYMENT_LABEL } from '../../features/ordering/status'
import type { OrderStatus, PaymentStatus } from '../../data/types'

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'whatsapp' | 'dark'; size?: 'sm' | 'md' | 'lg' }
const V = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-[0_6px_18px_-6px_rgb(199_68_8/0.7)]',
  secondary: 'bg-white text-espresso border border-line hover:border-brand-500 hover:text-brand-700',
  ghost: 'text-ink-700 hover:bg-brand-50',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  whatsapp: 'bg-[#0f7a40] text-white hover:bg-[#0b6633]',
  dark: 'bg-espresso text-cream hover:bg-black',
}
const S = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-5 text-[0.95rem]', lg: 'h-13 px-7 text-base' }

export function Button({ variant = 'primary', size = 'md', className = '', ...p }: BtnProps) {
  return <button {...p} className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${V[variant]} ${S[size]} ${className}`} />
}

export const Card = ({ className = '', ...p }: React.HTMLAttributes<HTMLDivElement>) => <div {...p} className={`min-w-0 rounded-2xl border border-line bg-white shadow-card ${className}`} />

const tone: Record<string, string> = {
  green: 'bg-fresh-50 text-[#1f6a39]', orange: 'bg-brand-50 text-brand-700', yellow: 'bg-[#fff4cc] text-[#7a5a00]',
  red: 'bg-red-50 text-red-800', grey: 'bg-stone-100 text-stone-700', blue: 'bg-sky-50 text-sky-800',
}
export const Badge = ({ color = 'grey', children }: { color?: keyof typeof tone; children: ReactNode }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${tone[color]}`}>{children}</span>
)

const STATUS_COLOR: Record<OrderStatus, keyof typeof tone> = {
  awaiting_payment: 'yellow', payment_confirmed: 'green', awaiting_acceptance: 'orange', accepted: 'blue', preparing: 'blue', ready: 'blue',
  out_for_delivery: 'orange', delivered: 'green', cancelled: 'grey', rejected: 'red', payment_failed: 'red', refunded: 'grey', partially_refunded: 'grey',
}
export const StatusBadge = ({ status }: { status: OrderStatus }) => <Badge color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Badge>
export const PaymentBadge = ({ status }: { status: PaymentStatus }) => (
  <Badge color={status === 'paid' ? 'green' : status === 'failed' ? 'red' : status === 'pending_verification' ? 'yellow' : 'grey'}>{PAYMENT_LABEL[status]}</Badge>
)

interface FieldProps { label: string; error?: string; hint?: string; children: (id: string, describedBy?: string) => ReactNode }
export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId()
  const desc = error ? `${id}-e` : hint ? `${id}-h` : undefined
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink-700">{label}</label>
      {children(id, desc)}
      {error ? <p id={`${id}-e`} role="alert" className="mt-1 text-sm font-medium text-red-700">{error}</p> : hint ? <p id={`${id}-h`} className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </div>
  )
}
const inputCls = (err?: string) => `w-full rounded-xl border bg-white px-3.5 py-2.5 text-base text-espresso placeholder:text-stone-400 transition focus:border-brand-500 ${err ? 'border-red-600' : 'border-line'}`

type TI = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }
export const TextInput = ({ label, error, hint, className = '', ...p }: TI) => (
  <Field label={label} error={error} hint={hint}>{(id, d) => <input id={id} aria-describedby={d} aria-invalid={!!error} {...p} className={`${inputCls(error)} ${className}`} />}</Field>
)
type TA = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: string }
export const TextArea = ({ label, error, hint, ...p }: TA) => (
  <Field label={label} error={error} hint={hint}>{(id, d) => <textarea id={id} aria-describedby={d} rows={3} {...p} className={inputCls(error)} />}</Field>
)
type SE = SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; hint?: string }
export const Select = ({ label, error, hint, children, ...p }: SE) => (
  <Field label={label} error={error} hint={hint}>{(id, d) => <select id={id} aria-describedby={d} {...p} className={inputCls(error)}>{children}</select>}</Field>
)

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-ink-700">
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-fresh' : 'bg-stone-300'}`}>
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </label>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-espresso/60 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`rise max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6 ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-stone-100"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Imperative confirm dialog for irreversible actions. */
export function useConfirm() {
  const [state, setState] = useState<{ title: string; body: string; label: string; danger?: boolean; run: () => void } | null>(null)
  const confirm = (title: string, body: string, run: () => void, label = 'Confirm', danger = false) => setState({ title, body, run, label, danger })
  const node = (
    <Modal open={!!state} onClose={() => setState(null)} title={state?.title ?? ''}>
      <p className="text-ink-700">{state?.body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setState(null)}>Go back</Button>
        <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => { state?.run(); setState(null) }}>{state?.label}</Button>
      </div>
    </Modal>
  )
  return { confirm, node }
}

export const EmptyState = ({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-white/60 px-6 py-12 text-center">
    {icon && <div className="text-brand-500">{icon}</div>}
    <h3 className="text-lg font-bold">{title}</h3>
    {body && <p className="max-w-md text-sm text-ink-500">{body}</p>}
    {action}
  </div>
)

export function useTitle(title: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} — Rice and Spice` : 'Rice and Spice — Good Food, Great Vibes'
    if (description) document.querySelector('meta[name="description"]')?.setAttribute('content', description)
  }, [title, description])
}
