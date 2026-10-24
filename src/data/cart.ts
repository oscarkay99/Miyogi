import { useSyncExternalStore } from 'react'
import { uid } from '../lib/ids'
import type { CartLine } from '../features/ordering/pricing'

export interface StoredLine extends CartLine { key: string }
interface CartState { lines: StoredLine[]; open: boolean }

const KEY = 'ras:cart:v1'
let state: CartState = { lines: read(), open: false }
const subs = new Set<() => void>()

function read(): StoredLine[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
function set(next: Partial<CartState>) {
  state = { ...state, ...next }
  try { localStorage.setItem(KEY, JSON.stringify(state.lines)) } catch { /* ignore */ }
  subs.forEach((s) => s())
}

export const useCart = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, () => state)

export const cart = {
  add(line: CartLine) {
    const sig = (l: CartLine) => `${l.itemId}|${[...l.optionIds].sort().join(',')}|${l.note}`
    const existing = state.lines.find((l) => sig(l) === sig(line))
    if (existing) set({ lines: state.lines.map((l) => (l === existing ? { ...l, quantity: Math.min(50, l.quantity + line.quantity) } : l)), open: true })
    else set({ lines: [...state.lines, { ...line, key: uid('l_') }], open: true })
  },
  setQty(key: string, q: number) { set({ lines: q < 1 ? state.lines.filter((l) => l.key !== key) : state.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, q) } : l)) }) },
  update(key: string, patch: Partial<CartLine>) { set({ lines: state.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }) },
  remove(key: string) { set({ lines: state.lines.filter((l) => l.key !== key) }) },
  clear() { set({ lines: [] }) },
  open(v: boolean) { set({ open: v }) },
}
