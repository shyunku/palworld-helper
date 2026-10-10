import { useSyncExternalStore } from 'react'

/**
 * A tiny shared, persisted store (localStorage). Every component using it sees the same value,
 * so e.g. a holding count typed in one window shows up in all the others.
 */
export function persistedStore<T>(key: string, initial: T) {
  let value: T = initial
  try {
    const raw = localStorage.getItem(key)
    if (raw !== null) value = JSON.parse(raw) as T
  } catch {
    /* storage unavailable: keep the in-memory value */
  }
  const subs = new Set<() => void>()
  const subscribe = (fn: () => void) => {
    subs.add(fn)
    return () => void subs.delete(fn)
  }
  const get = () => value
  const set = (next: T) => {
    value = next
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      /* ignore */
    }
    subs.forEach((fn) => fn())
  }
  return {
    set,
    get,
    use: () => [useSyncExternalStore(subscribe, get), set] as const,
  }
}
