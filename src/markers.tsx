import { useEffect, useState } from 'react'
import { iconSrc } from './ItemIcon'

export type LayerKey = 'fast' | 'tower' | 'alpha' | 'dungeon'

export interface RawMarker {
  x: number
  y: number
  n: string
  lv?: number
  c?: string
  /** alpha pals: portrait icon file */
  i?: string
}

export interface MarkerData extends Record<LayerKey, RawMarker[]> {
  icons: Record<LayerKey, string>
}

export const LAYER_INFO: { key: LayerKey; label: string }[] = [
  { key: 'fast', label: '고속 이동' },
  { key: 'tower', label: '세력 탑' },
  { key: 'alpha', label: '알파 팰' },
  { key: 'dungeon', label: '던전' },
]

let cache: Promise<MarkerData | null> | null = null
const load = () =>
  (cache ??= fetch(`${import.meta.env.BASE_URL}data/markers.json`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null))

export function useMarkers() {
  const [d, setD] = useState<MarkerData | null>(null)
  useEffect(() => {
    load().then(setD)
  }, [])
  return d
}

/** A marker as the map draws it: constant on-screen size, game icon (alpha pals = round portrait). */
export interface MapMarker {
  x: number
  y: number
  icon: string
  name: string
  /** layer label (고속 이동 / 알파 팰 …) */
  label: string
  lv?: number
  note?: string
  round?: boolean
  size: number
}

export function toMapMarkers(d: MarkerData | null, on: Record<LayerKey, boolean>): MapMarker[] {
  if (!d) return []
  const out: MapMarker[] = []
  for (const { key, label } of LAYER_INFO) {
    if (!on[key]) continue
    for (const m of d[key]) {
      out.push({
        x: m.x,
        y: m.y,
        icon: m.i ?? d.icons[key],
        name: m.n || label,
        label,
        lv: m.lv,
        note: m.c,
        round: key === 'alpha' && !!m.i,
        size: key === 'alpha' ? 34 : key === 'fast' ? 42 : key === 'tower' ? 36 : 28,
      })
    }
  }
  return out
}

export { iconSrc }
