import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create singleton ONCE at module load time
const browserClient = createBrowserClient<Database>(
  supabaseUrl,
  supabaseAnonKey
)

// Export simple getter
export function createClient() {
  return browserClient
}
