import { X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useStored } from './useStored'

export type WinPage = 'items' | 'pals' | 'structs' | 'places'

export interface Win {
  id: string
  kind: 'list' | 'detail'
  page: WinPage
  itemId?: string
  x: number
  y: number
  w: number
  h: number
  z: number
}

const MAX_DETAIL = 4
const MIN_W = 300
const MIN_H = 180

export const listId = (page: WinPage) => `l:${page}`
export const detailId = (page: WinPage, itemId: string) => `d:${page}:${itemId}`

const vw = () => (typeof innerWidth === 'number' ? innerWidth : 1280)
const vh = () => (typeof innerHeight === 'number' ? innerHeight : 760)

/** Keep a window reachable even if the screen got smaller since it was placed. */
const clampWin = (w: Win): Win => ({
  ...w,
  x: Math.max(-w.w + 80, Math.min(w.x, vw() - 80)),
  y: Math.max(0, Math.min(w.y, vh() - 40)),
})

export function useWindows() {
  const [stored, setWins] = useStored<Win[]>('ui.windows.v1', [])
  // drop windows saved by earlier versions (the layer toggles used to be a window)
  const wins = stored.filter((w) => (w.kind as string) !== 'layers')
  const [hidden, setHidden] = useState(false)

  const topZ = (ws: Win[]) => ws.reduce((m, w) => Math.max(m, w.z), 0)

  const focus = useCallback((id: string) => setWins((ws) => ws.map((w) => (w.id === id ? { ...w, z: topZ(ws) + 1 } : w))), [setWins])

  const toggleList = useCallback(
    (page: WinPage) => {
      setHidden(false)
      setWins((ws) => {
        const id = listId(page)
        if (ws.some((w) => w.id === id)) return ws.filter((w) => w.id !== id)
        const n = ws.length % 6 // cascade so new windows do not stack exactly on top of each other
        const h = Math.min(vh() - 24, 760)
        return [...ws, { id, kind: 'list', page, x: 92 + n * 30, y: 12 + n * 24, w: 340, h, z: topZ(ws) + 1 }]
      })
    },
    [setWins],
  )

  const openDetail = useCallback(
    (page: WinPage, itemId: string) => {
      setHidden(false)
      setWins((ws) => {
        const id = detailId(page, itemId)
        const z = topZ(ws) + 1
        if (ws.some((w) => w.id === id)) return ws.map((w) => (w.id === id ? { ...w, z } : w))
        const details = ws.filter((w) => w.kind === 'detail')
        const n = details.length
        const h = Math.min(vh() - 24, 720)
        const w = 420
        const next: Win = { id, kind: 'detail', page, itemId, x: Math.max(12, vw() - w - 12 - (n % 4) * 28), y: 12 + (n % 4) * 24, w, h, z }
        let out = [...ws, next]
        // keep the screen tidy: drop the oldest detail window beyond the limit
        const all = out.filter((x) => x.kind === 'detail')
        if (all.length > MAX_DETAIL) {
          const oldest = [...all].sort((a, b) => a.z - b.z)[0]
          out = out.filter((x) => x.id !== oldest.id)
        }
        return out
      })
    },
    [setWins],
  )

  const close = useCallback((id: string) => setWins((ws) => ws.filter((w) => w.id !== id)), [setWins])
  const update = useCallback((id: string, patch: Partial<Win>) => setWins((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w))), [setWins])

  return { wins: wins.map(clampWin), hidden, setHidden, focus, toggleList, openDetail, close, update }
}

interface WindowProps {
  win: Win
  title: string
  icon: React.ReactNode
  focused: boolean
  onFocus: () => void
  onClose: () => void
  onChange: (patch: Partial<Win>) => void
  children: React.ReactNode
}

type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const DIRS: Dir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

/** A floating glass window: drag the title bar to move, drag any edge or corner to resize. */
export default function Window({ win, title, icon, focused, onFocus, onClose, onChange, children }: WindowProps) {
  // live geometry while dragging; committed (and persisted) on release
  const [live, setLive] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const start = useRef<{ mode: 'move' | Dir; px: number; py: number; x: number; y: number; w: number; h: number } | null>(null)
  const g = live ?? win

  const begin = (e: React.PointerEvent, mode: 'move' | Dir) => {
    e.stopPropagation()
    onFocus()
    start.current = { mode, px: e.clientX, py: e.clientY, x: win.x, y: win.y, w: win.w, h: win.h }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    const s = start.current
    if (!s) return
    const dx = e.clientX - s.px
    const dy = e.clientY - s.py
    if (s.mode === 'move') return setLive({ x: s.x + dx, y: Math.max(0, s.y + dy), w: s.w, h: s.h })
    let { x, y, w, h } = s
    // the edge opposite to the dragged one stays put (also when hitting the minimum size)
    if (s.mode.includes('e')) w = Math.max(MIN_W, s.w + dx)
    if (s.mode.includes('s')) h = Math.max(MIN_H, s.h + dy)
    if (s.mode.includes('w')) {
      w = Math.max(MIN_W, s.w - dx)
      x = s.x + s.w - w
    }
    if (s.mode.includes('n')) {
      const ny = Math.max(0, s.y + dy)
      h = Math.max(MIN_H, s.h + s.y - ny)
      y = s.y + s.h - h
    }
    setLive({ x, y, w, h })
  }
  const end = () => {
    if (live) onChange(live)
    start.current = null
    setLive(null)
  }

  return (
    <div
      className={`win glass ${focused ? 'focus' : ''}`}
      style={{ left: g.x, top: g.y, width: g.w, height: g.h, zIndex: 10 + win.z }}
      onPointerDown={onFocus}
    >
      <div className="wtitle" onPointerDown={(e) => begin(e, 'move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        {icon}
        <b>{title}</b>
        <button title="닫기" onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className={`wbody wb-${win.kind}`}>{children}</div>
      {DIRS.map((d) => (
        <div key={d} className={`wrs wrs-${d}`} onPointerDown={(e) => begin(e, d)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
      ))}
    </div>
  )
}
