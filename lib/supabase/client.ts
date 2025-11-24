import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

// Singleton instance
let client: ReturnType<typeof createBrowserClient<Database>> | undefined

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  // Return existing client if already created
  if (client) {
    return client
  }

  // Create and cache the client
  client = createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey
  )

  return client
}
