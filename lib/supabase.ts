import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Lazy singleton - only create when first accessed
let _supabase: ReturnType<typeof createClient> | null = null

export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get: (target, prop) => {
    if (!_supabase) {
      _supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storageKey: 'supabase-legacy-auth'
        }
      })
    }
    return (_supabase as any)[prop]
  }
})

// Export types for user and session
export type { User } from '@supabase/supabase-js'
export type { Session } from '@supabase/supabase-js'