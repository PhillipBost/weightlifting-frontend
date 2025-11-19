/**
 * Supabase utility functions for timeout protection and error handling
 */

export async function queryWithTimeout<T>(
  queryPromise: Promise<T>,
  timeoutMs: number = 5000,
  queryName: string = 'Query'
): Promise<T> {
  let timeoutId: NodeJS.Timeout

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      console.warn(`[TIMEOUT] ${queryName} timed out after ${timeoutMs}ms`)
      reject(new Error(`${queryName} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    const result = await Promise.race([queryPromise, timeoutPromise])
    clearTimeout(timeoutId!)
    return result
  } catch (err) {
    clearTimeout(timeoutId!)
    console.error(`[TIMEOUT_ERROR] ${queryName}:`, err)
    throw err
  }
}

/**
 * Retry a query function with exponential backoff
 * Useful for handling JWT/RLS timing issues during auth state changes
 */
export async function queryWithRetry<T>(
  queryFn: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelayMs?: number
    maxDelayMs?: number
    queryName?: string
  } = {}
): Promise<T> {
  const {
    maxRetries = 4,
    initialDelayMs = 100,
    maxDelayMs = 2000,
    queryName = 'Query'
  } = options

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[RETRY] ${queryName} attempt ${attempt + 1}/${maxRetries + 1}`)
      const result = await queryFn()

      if (attempt > 0) {
        console.log(`[RETRY] ${queryName} succeeded on attempt ${attempt + 1}`)
      }

      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry if we've exhausted attempts
      if (attempt === maxRetries) {
        console.error(`[RETRY] ${queryName} failed after ${maxRetries + 1} attempts:`, lastError.message)
        break
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs)
      console.warn(`[RETRY] ${queryName} attempt ${attempt + 1} failed, retrying in ${delay}ms...`, lastError.message)

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError || new Error(`${queryName} failed after ${maxRetries + 1} attempts`)
}
