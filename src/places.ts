import { LAYER_INFO, type LayerKey, type MarkerData } from './markers'

/** A named place on the map (any marker with a name): used by the 장소 window and the quick search. */
export interface Place {
  key: string
  k: LayerKey
  x: number
  y: number
  n: string
  lv?: number
  c?: string
  icon: string
  round: boolean
}

export const KIND_LABEL = Object.fromEntries(LAYER_INFO.map((l) => [l.key, l.label])) as Record<LayerKey, string>

export function buildPlaces(d: MarkerData | null): Place[] {
  if (!d) return []
  return LAYER_INFO.flatMap(({ key, label }) =>
    d[key].map((m, i) => ({
      key: `${key}${i}`,
      k: key,
      x: m.x,
      y: m.y,
      n: m.n || label,
      lv: m.lv,
      c: m.c,
      icon: m.i ?? d.icons[key],
      round: key === 'alpha' && !!m.i,
    })),
  )
}

/** Name search; names that start with the query come first. */
export function searchPlaces(all: Place[], q: string, kinds?: Set<LayerKey>): Place[] {
  const s = q.trim().toLowerCase()
  const pool = kinds ? all.filter((p) => kinds.has(p.k)) : all
  if (!s) return pool
  const hit = pool.filter((p) => p.n.toLowerCase().includes(s))
  return [...hit.filter((p) => p.n.toLowerCase().startsWith(s)), ...hit.filter((p) => !p.n.toLowerCase().startsWith(s))]
}
