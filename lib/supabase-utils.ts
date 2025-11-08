/**
 * Supabase utility functions for timeout protection and error handling
 */

export async function queryWithTimeout<T>(
  queryPromise: Promise<T>,
  timeoutMs: number = 5000,
  queryName: string = 'Query'
): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => {
      console.warn(`[TIMEOUT] ${queryName} timed out after ${timeoutMs}ms`)
      reject(new Error(`${queryName} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([queryPromise, timeoutPromise])
  } catch (err) {
    console.error(`[TIMEOUT_ERROR] ${queryName}:`, err)
    throw err
  }
}
