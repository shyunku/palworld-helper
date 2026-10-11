import { Locate, Minus, Plus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { iconSrc } from './ItemIcon'
import type { MapMarker } from './markers'
import type { SpawnData } from './types'

export const MAP_SIZE = 4096
/** the smallest the map may get: this fraction of the size at which the whole map just fits the screen */
const MIN_FIT_RATIO = 0.8
const MAX = 2

interface View {
  x: number
  y: number
  s: number
}

export interface MapPoint {
  x: number
  y: number
  lv?: number
  cls?: string
}

export interface Focus {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Space (px) covered by floating panels; the map view is fitted into what is left. */
export interface Insets {
  l: number
  r: number
  t: number
  b: number
}

/** Day/night spawn dots of one pal, as map points. */
export function spawnPoints(sp: SpawnData | null, time: 'd' | 'n'): MapPoint[] {
  return (sp?.[time] ?? []).map(([x, y, lv]) => ({ x, y, lv, cls: time === 'n' ? 'night' : 'day' }))
}

export function boundsOf(points: MapPoint[]): Focus | null {
  if (!points.length) return null
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

export interface Highlight {
  x: number
  y: number
  icon: string
  round?: boolean
  label: string
}

interface Props {
  points?: MapPoint[]
  /** the place picked from the 장소 window / search: pulsing ring + label */
  highlight?: Highlight | null
  markers?: MapMarker[]
  /** fit the view to this rectangle (map pixels); null = show the whole map */
  focus?: Focus | null
  insets?: Insets
  note?: string
}

/** Full-bleed, pannable/zoomable map used as the app background. */
export default function MapView({ points = [], markers = [], highlight = null, focus = null, insets = { l: 0, r: 0, t: 0, b: 0 }, note }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null)
  const ptrs = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<number | null>(null)
  const [v, setV] = useState<View>({ x: 0, y: 0, s: 0.2 })
  const [anim, setAnim] = useState(false)

  /** minimum zoom for the current container size */
  const minScale = () => {
    const r = box.current!.getBoundingClientRect()
    return (MIN_FIT_RATIO * Math.min(r.width, r.height)) / MAP_SIZE
  }

  const focusKey = focus ? `${focus.x0},${focus.y0},${focus.x1},${focus.y1}` : ''
  // latest props for the fit callback without making it re-run when panels open/close
  const live = useRef({ focus, insets })
  live.current = { focus, insets }

  /** Fit the focus area (or the whole map) into the part of the screen the panels leave free. */
  const fit = useCallback((animate: boolean) => {
    const { focus, insets } = live.current
    const r = box.current!.getBoundingClientRect()
    const aw = Math.max(100, r.width - insets.l - insets.r)
    const ah = Math.max(100, r.height - insets.t - insets.b)
    const f = focus ?? { x0: 0, y0: 0, x1: MAP_SIZE, y1: MAP_SIZE }
    const pad = focus ? 260 : 0
    const w = Math.max(f.x1 - f.x0, 200) + pad
    const h = Math.max(f.y1 - f.y0, 200) + pad
    const s = Math.max(minScale(), Math.min(aw / w, ah / h, focus ? 1.2 : 1))
    const cx = (f.x0 + f.x1) / 2
    const cy = (f.y0 + f.y1) / 2
    setAnim(animate)
    setV({ s, x: insets.l + aw / 2 - cx * s, y: insets.t + ah / 2 - cy * s })
  }, [])

  // The map stays where the user left it across menu changes. It only re-fits
  // on first show, when a new pal's spawn area appears, or via the reset button.
  const placed = useRef(false)
  useEffect(() => {
    const r = box.current!.getBoundingClientRect()
    if (!placed.current && r.width > 0) {
      placed.current = true
      fit(false)
    } else if (placed.current && focusKey) {
      fit(true)
    }
  }, [focusKey, fit])

  useEffect(() => {
    // first layout can report 0 size; place the map as soon as there is room
    const ro = new ResizeObserver(() => {
      if (!placed.current && box.current!.getBoundingClientRect().width > 0) {
        placed.current = true
        fit(false)
      }
    })
    ro.observe(box.current!)
    return () => ro.disconnect()
  }, [fit])

  const zoomAt = (cx: number, cy: number, factor: number) => {
    setAnim(false)
    setV((p) => {
      const s = Math.min(MAX, Math.max(minScale(), p.s * factor))
      const k = s / p.s
      return { s, x: cx - (cx - p.x) * k, y: cy - (cy - p.y) * k }
    })
  }

  useEffect(() => {
    const el = box.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.15 : 1 / 1.15)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const center = () => {
    const r = box.current!.getBoundingClientRect()
    return [r.width / 2, r.height / 2] as const
  }

  const dot = Math.min(40, Math.max(6, 9 / v.s))

  return (
    <div
      className="mapwrap base"
      ref={box}
      onPointerDown={(e) => {
        setAnim(false)
        e.currentTarget.setPointerCapture(e.pointerId)
        ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (ptrs.current.size === 1) drag.current = { px: e.clientX, py: e.clientY, vx: v.x, vy: v.y }
        else {
          drag.current = null
          const [a, b] = [...ptrs.current.values()]
          pinch.current = Math.hypot(a.x - b.x, a.y - b.y)
        }
      }}
      onPointerMove={(e) => {
        if (ptrs.current.has(e.pointerId)) ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (ptrs.current.size === 2 && pinch.current) {
          // two fingers: pinch zoom around the midpoint
          const [a, b] = [...ptrs.current.values()]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          const r = box.current!.getBoundingClientRect()
          zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, d / pinch.current)
          pinch.current = d
          return
        }
        const d = drag.current
        if (d) setV((p) => ({ ...p, x: d.vx + e.clientX - d.px, y: d.vy + e.clientY - d.py }))
      }}
      onPointerUp={(e) => {
        ptrs.current.delete(e.pointerId)
        pinch.current = null
        const rest = [...ptrs.current.values()][0]
        // one finger left after a pinch: continue dragging from there
        drag.current = rest ? { px: rest.x, py: rest.y, vx: v.x, vy: v.y } : null
      }}
      onPointerCancel={(e) => {
        ptrs.current.delete(e.pointerId)
        pinch.current = null
        drag.current = null
      }}
    >
      <div
        className="maplayer"
        style={{
          transform: `translate(${v.x}px, ${v.y}px) scale(${v.s})`,
          width: MAP_SIZE,
          height: MAP_SIZE,
          transition: anim ? 'transform .55s ease' : 'none',
        }}
      >
        <img src={`${import.meta.env.BASE_URL}map/palpagos.webp`} width={MAP_SIZE} height={MAP_SIZE} draggable={false} alt="팰파고스 제도 지도" />
        {markers.map((m, i) => (
          <img
            key={`m${i}`}
            className={`mmark ${m.round ? 'round' : ''}`}
            src={iconSrc(m.icon)}
            data-tip="marker"
            data-mname={m.name}
            data-mlabel={m.label}
            data-mlv={m.lv ?? ''}
            data-mnote={m.note ?? ''}
            data-micon={m.icon}
            data-mround={m.round ? '1' : ''}
            alt=""
            style={{ left: m.x - m.size / v.s / 2, top: m.y - m.size / v.s / 2, width: m.size / v.s, height: m.size / v.s }}
          />
        ))}
        {highlight && (
          <div className="hlmark" style={{ left: highlight.x, top: highlight.y, transform: `scale(${1 / v.s})` }}>
            <span className="hl-ring" />
            <img className={highlight.round ? 'round' : ''} src={iconSrc(highlight.icon)} alt="" />
            <span className="hl-label">{highlight.label}</span>
          </div>
        )}
        {points.map((p, i) => (
          <span key={i} className={`mdot ${p.cls ?? ''}`} style={{ left: p.x - dot / 2, top: p.y - dot / 2, width: dot, height: dot }} />
        ))}
      </div>
      <div className="mapctl" onPointerDown={(e) => e.stopPropagation()}>
        <button title="확대" onClick={() => zoomAt(...center(), 1.4)}><Plus size={18} /></button>
        <button title="축소" onClick={() => zoomAt(...center(), 1 / 1.4)}><Minus size={18} /></button>
        <button title="처음 위치" onClick={() => fit(true)}><Locate size={18} /></button>
      </div>
      {note && <div className="note">{note}</div>}
    </div>
  )
}
