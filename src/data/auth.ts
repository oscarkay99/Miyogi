import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import { refresh } from './store'

export type Role = 'owner' | 'manager' | 'kitchen' | 'delivery'
export interface AuthState { status: 'loading' | 'out' | 'staff' | 'nostaff'; role: Role | null; email: string }

let state: AuthState = { status: 'loading', role: null, email: '' }
const subs = new Set<() => void>()
const set = (s: AuthState) => { state = s; subs.forEach((f) => f()) }

async function resolve() {
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user) return set({ status: 'out', role: null, email: '' })
  const { data: row } = await supabase.from('staff').select('role').eq('user_id', user.id).maybeSingle()
  set(row ? { status: 'staff', role: row.role as Role, email: user.email ?? '' } : { status: 'nostaff', role: null, email: user.email ?? '' })
  void refresh()
}
supabase.auth.onAuthStateChange(() => { void resolve() })
void resolve()

export const useAuth = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, () => state)

export async function login(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  return error ? 'Incorrect email or password.' : null
}
export async function logout() { await supabase.auth.signOut({ scope: 'local' }) }
