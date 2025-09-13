import { supabase } from './supabase'

export async function authenticatedFetch(url: string, options: RequestInit = {}) {
  // Get the current session
  const { data: { session }, error } = await supabase.auth.getSession()
  
  if (error || !session?.access_token) {
    throw new Error('Authentication required')
  }

  // Add the authorization header
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)
  headers.set('Content-Type', 'application/json')

  return fetch(url, {
    ...options,
    headers,
  })
}