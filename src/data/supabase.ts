import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill them in.')

/** Browser client. Only the public (publishable) key is ever used here; row-level security does the gatekeeping. */
export const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
