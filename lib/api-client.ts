// With cookie-based auth, we no longer need to manually add auth headers
// The session cookie will be automatically sent with fetch requests
export async function authenticatedFetch(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')

  return fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin', // Ensure cookies are sent
  })
}