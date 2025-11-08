/**
 * Supabase client health monitoring
 */

import { supabase } from './supabase'
import { queryWithTimeout } from './supabase-utils'

export interface SupabaseHealthStatus {
  healthy: boolean
  session: boolean
  dataAccess: boolean
  error?: string
  timestamp: number
}

export async function checkSupabaseHealth(): Promise<SupabaseHealthStatus> {
  const timestamp = Date.now()

  try {
    // Check session
    const sessionResult = await queryWithTimeout(
      supabase.auth.getSession(),
      8000,
      'getSession'
    )
    const { data: { session }, error: sessionError } = sessionResult

    // Check data access with a simple query
    let data, queryError;
    try {
      const result = await queryWithTimeout(
        supabase.from('lifters').select('lifter_id').limit(1) as any,
        8000,
        'data access query'
      ) as any
      data = result.data
      queryError = result.error
    } catch (err) {
      queryError = err
      data = null
    }

    const health: SupabaseHealthStatus = {
      healthy: !sessionError && !queryError,
      session: !!session,
      dataAccess: !!data && data.length >= 0,
      error: sessionError?.message || queryError?.message,
      timestamp
    }

    return health
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    return {
      healthy: false,
      session: false,
      dataAccess: false,
      error,
      timestamp
    }
  }
}
