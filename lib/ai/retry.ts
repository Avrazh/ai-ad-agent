/**
 * Retries an async function up to `maxAttempts` times when a 529 (overloaded)
 * error is returned. Waits 2s → 4s → 8s between attempts.
 * Any other error is thrown immediately without retrying.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 4
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 529) {
        lastErr = err;
        if (attempt < maxAttempts) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.warn(`[${label}] 529 overloaded — retrying in ${delay / 1000}s (attempt ${attempt}/${maxAttempts})`);
          await new Promise((r) => setTimeout(r, delay));
        }
      } else {
        throw err; // non-529 errors fail immediately
      }
    }
  }
  throw lastErr;
}
