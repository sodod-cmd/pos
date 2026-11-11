import 'server-only'

const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 5

// Per-instance memory: enough to slow down password guessing without extra infrastructure.
const failures = new Map<string, { count: number; resetAt: number }>()

/** Milliseconds until `key` may try again, or 0 when it is not locked out. */
export function lockedFor(key: string) {
  const entry = failures.get(key)
  if (!entry) return 0
  if (entry.resetAt <= Date.now()) {
    failures.delete(key)
    return 0
  }
  return entry.count >= MAX_FAILURES ? entry.resetAt - Date.now() : 0
}

export function recordFailure(key: string) {
  const entry = failures.get(key)
  if (!entry || entry.resetAt <= Date.now()) failures.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS })
  else entry.count += 1
}

export function clearFailures(key: string) {
  failures.delete(key)
}
