import { Backpack, Eye, EyeOff, Hammer, Map as MapIcon, MapPin, PawPrint, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { loadSpawns, useCatalog, type Catalog } from './data'
import ItemsPage, { ItemDetail, ItemsList } from './ItemsPage'
import type { Go } from './MatTable'
import MapView, { boundsOf, spawnPoints, type Focus, type Highlight } from './MapView'
import PalsPage, { PalDetail, PalsList } from './PalsPage'
import PlacesPanel from './PlacesPanel'
import { buildPlaces, type Place } from './places'
import StructsPage, { StructDetail, StructsList } from './StructsPage'
import BlurDebug from './BlurDebug'
import LayersBar from './LayersBar'
import { toMapMarkers, useMarkers, type LayerKey } from './markers'
import TooltipLayer from './Tooltip'
import { useStored } from './useStored'
import type { SpawnData } from './types'
import Window, { listId, useWindows, type Win, type WinPage } from './windows'

type Page = 'map' | WinPage

const MENU: { page: Page; icon: LucideIcon; label: string }[] = [
  { page: 'map', icon: MapIcon, label: '지도' },
  { page: 'items', icon: Backpack, label: '아이템' },
  { page: 'pals', icon: PawPrint, label: '팰' },
  { page: 'structs', icon: Hammer, label: '구조물' },
]
const WIN_MENU: { page: WinPage; icon: LucideIcon; label: string }[] = [
  { page: 'items', icon: Backpack, label: '아이템' },
  { page: 'pals', icon: PawPrint, label: '팰' },
  { page: 'structs', icon: Hammer, label: '구조물' },
  { page: 'places', icon: MapPin, label: '장소' },
]
/** pages that have detail windows / URLs (places only has the list window) */
const isWinPage = (p?: string): p is Exclude<WinPage, 'places'> => p === 'items' || p === 'pals' || p === 'structs'

export const MOBILE_QUERY = '(max-width: 767px)'

function useMobile() {
  const [m, setM] = useState(() => matchMedia(MOBILE_QUERY).matches)
  useEffect(() => {
    const mq = matchMedia(MOBILE_QUERY)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return m
}

// routes: /items/:id, /pals/:id, /structs/:id (id optional). Wide screens: the URL follows the focused detail window.
export const pathFor = (page: Page, id?: string | null) => `/${page}${id ? `/${encodeURIComponent(id)}` : ''}`

/** Marker layer toggles (persisted) and the markers they produce. */
function useLayers() {
  const data = useMarkers()
  const [on, setOn] = useStored<Record<LayerKey, boolean>>('ui.layers', { fast: false, tower: false, alpha: false, dungeon: false })
  const markers = useMemo(() => toMapMarkers(data, on), [data, on])
  const places = useMemo(() => buildPlaces(data), [data])
  // the place picked in the 장소 window / quick search: it is drawn highlighted and the map flies to it
  const [place, setPlace] = useState<Place | null>(null)
  const highlight: Highlight | null = place ? { x: place.x, y: place.y, icon: place.icon, round: place.round, label: `${place.lv ? `Lv.${place.lv} ` : ''}${place.n}` } : null
  const placeFocus: Focus | null = place ? { x0: place.x - 400, y0: place.y - 400, x1: place.x + 400, y1: place.y + 400 } : null
  return { data, on, setOn, markers, places, place, setPlace, highlight, placeFocus }
}

/** Spawn dots (day/night) of one pal, plus the map area to focus on. */
function useSpawns(palId: string | null) {
  const [time, setTime] = useState<'d' | 'n'>('d')
  const [sp, setSp] = useState<{ id: string; data: SpawnData | null } | null>(null)
  useEffect(() => {
    if (!palId) return setSp(null)
    let live = true
    loadSpawns(palId).then((data) => live && setSp({ id: palId, data }))
    return () => {
      live = false
    }
  }, [palId])
  const points = useMemo(() => (sp && sp.id === palId ? spawnPoints(sp.data, time) : []), [sp, palId, time])
  const focus = useMemo(() => boundsOf(points), [points])
  return { time, setTime, points, focus }
}

function nameOf(w: Win, c: Catalog | null) {
  if (w.kind === 'list') return WIN_MENU.find((m) => m.page === w.page)!.label
  const id = w.itemId!
  return (w.page === 'items' ? c?.itemById.get(id)?.name : w.page === 'pals' ? c?.palById.get(id)?.name : c?.structById.get(id)?.name) ?? id
}

// ---------------------------------------------------------------- desktop: map + floating windows

function Desktop({ page, id }: { page?: string; id?: string }) {
  const catalog = useCatalog()
  const navigate = useNavigate()
  const loc = useLocation()
  const W = useWindows()
  // two independent focus groups: list windows (팰/구조물/아이템) and detail windows.
  // The most recently used window of each group is focused, so one of each can be sharp at the same time.
  const topOf = (kind: Win['kind']) => W.wins.filter((w) => w.kind === kind).reduce((m, w) => Math.max(m, w.z), 0)
  const topList = topOf('list')
  const topDetail = topOf('detail')

  // the front-most detail window decides which pal (if any) is drawn on the map
  const frontDetail = [...W.wins].filter((w) => w.kind === 'detail').sort((a, b) => b.z - a.z)[0]
  const palId = frontDetail?.page === 'pals' ? frontDetail.itemId! : null
  const { time, setTime, points, focus } = useSpawns(palId)
  const layers = useLayers()

  // URL -> window (deep link, back/forward): make sure that detail window is open and in front
  const { openDetail } = W
  useEffect(() => {
    if (isWinPage(page) && id) openDetail(page, id)
  }, [loc.key, page, id, openDetail])

  const go: Go = useCallback(
    (p, to) => {
      if (p === 'map') return W.setHidden(true) // "show only the map"
      if (to) {
        W.openDetail(p, to)
        navigate(pathFor(p, to))
      } else {
        W.toggleList(p)
      }
    },
    [W, navigate],
  )

  const selOf = (p: WinPage) => [...W.wins].filter((w) => w.kind === 'detail' && w.page === p).sort((a, b) => b.z - a.z)[0]?.itemId ?? null

  return (
    <div className="app">
      <MapView points={points} markers={layers.markers} highlight={layers.highlight} focus={layers.placeFocus ?? focus} insets={{ l: 76, r: 12, t: 12, b: 12 }} />
      <LayersBar data={layers.data} on={layers.on} setOn={layers.setOn} places={layers.places} selected={layers.place} onPick={layers.setPlace} />
      <nav className="rail glass">
        {WIN_MENU.map(({ page: pg, icon: Icon, label }) => (
          <a key={pg} className={W.wins.some((w) => w.id === listId(pg)) ? 'on' : ''} data-l={label} onClick={() => W.toggleList(pg)}>
            <Icon size={18} strokeWidth={1.75} />
          </a>
        ))}
        <hr />
        <a data-l={W.hidden ? '창 다시 보기' : '모든 창 숨기기 (지도만 보기)'} onClick={() => W.setHidden(!W.hidden)}>
          {W.hidden ? <Eye size={18} strokeWidth={1.75} /> : <EyeOff size={18} strokeWidth={1.75} />}
        </a>
      </nav>
      {!W.hidden &&
        W.wins.map((w) => {
          const Icon = WIN_MENU.find((m) => m.page === w.page)!.icon
          return (
            <Window
              key={w.id}
              win={w}
              title={nameOf(w, catalog)}
              icon={<Icon size={16} strokeWidth={1.75} />}
              focused={w.z === (w.kind === 'list' ? topList : topDetail)}
              onFocus={() => W.focus(w.id)}
              onClose={() => {
                W.close(w.id)
                if (w.page === 'places') layers.setPlace(null) // closing the 장소 window clears its map highlight
              }}
              onChange={(patch) => W.update(w.id, patch)}
            >
              {w.kind === 'list' ? (
                w.page === 'items' ? <ItemsList catalog={catalog} selId={selOf('items')} go={go} />
                : w.page === 'pals' ? <PalsList catalog={catalog} selId={selOf('pals')} go={go} />
                : w.page === 'places' ? <PlacesPanel data={layers.data} places={layers.places} selected={layers.place} onSelect={layers.setPlace} />
                : <StructsList catalog={catalog} selId={selOf('structs')} go={go} />
              ) : w.page === 'items' ? (
                <ItemDetail item={catalog?.itemById.get(w.itemId!)} catalog={catalog} go={go} />
              ) : w.page === 'pals' ? (
                <PalDetail
                  pal={catalog?.palById.get(w.itemId!)}
                  catalog={catalog}
                  go={go}
                  spawn={{ time, setTime, count: w.itemId === palId ? points.length : 0 }}
                />
              ) : (
                <StructDetail s={catalog?.structById.get(w.itemId!)} catalog={catalog} go={go} />
              )}
            </Window>
          )
        })}
      <TooltipLayer catalog={catalog} />
      {new URLSearchParams(location.search).get('debug') === 'blur' && <BlurDebug />}
    </div>
  )
}

// ---------------------------------------------------------------- mobile: bottom tabs, list/detail screens

function Mobile({ page, id }: { page?: string; id?: string }) {
  const catalog = useCatalog()
  const navigate = useNavigate()
  const go: Go = useCallback((p, to) => navigate(pathFor(p, to)), [navigate])
  const palId = page === 'pals' || page === 'map' ? (id ?? null) : null
  const { time, setTime, points, focus } = useSpawns(palId)
  const layers = useLayers()
  const mapOnly = page === 'map'
  const palName = palId ? catalog?.palById.get(palId)?.name : undefined

  return (
    <div className={`app ${mapOnly ? 'maponly' : ''}`}>
      <MapView points={points} markers={layers.markers} highlight={layers.highlight} focus={layers.placeFocus ?? focus} insets={{ l: 0, r: 0, t: 0, b: 58 }} note={palName && mapOnly ? `${palName} 서식 위치 · ${time === 'd' ? '낮' : '밤'} · ${points.length}곳` : undefined} />
      {mapOnly && <LayersBar data={layers.data} on={layers.on} setOn={layers.setOn} places={layers.places} selected={layers.place} onPick={layers.setPlace} />}
      {mapOnly && palId && (
        <div className="mapbar glass">
          <b>{palName}</b>
          <div className="seg">
            <button className={time === 'd' ? 'on' : ''} onClick={() => setTime('d')}>낮</button>
            <button className={time === 'n' ? 'on' : ''} onClick={() => setTime('n')}>밤</button>
          </div>
          <button className="linkbtn" onClick={() => go('pals', palId)}>팰 정보 →</button>
        </div>
      )}
      <nav className="rail glass">
        {MENU.map(({ page: pg, icon: Icon, label }) => (
          <NavLink key={pg} to={pathFor(pg)} className={page === pg ? 'on' : ''} data-l={label}>
            <Icon size={20} strokeWidth={1.75} />
            <span className="rl">{label}</span>
          </NavLink>
        ))}
      </nav>
      <main className={id && !mapOnly ? 'has-sel' : ''}>
        {page === 'items' && <ItemsPage catalog={catalog} selId={id ?? null} go={go} />}
        {page === 'pals' && <PalsPage catalog={catalog} selId={id ?? null} go={go} spawn={{ time, setTime, count: points.length }} />}
        {page === 'structs' && <StructsPage catalog={catalog} selId={id ?? null} go={go} />}
      </main>
      <TooltipLayer catalog={catalog} />
    </div>
  )
}

function Shell() {
  const { page, id } = useParams<{ page?: string; id?: string }>()
  const mobile = useMobile()
  if (page && !MENU.some((m) => m.page === page)) return <Navigate to={mobile ? '/items' : '/'} replace />
  if (mobile) return page ? <Mobile page={page} id={id} /> : <Navigate to="/items" replace />
  if (page === 'map') return <Navigate to="/" replace />
  return <Desktop page={page} id={id} />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Shell />} />
      <Route path="/:page/:id?" element={<Shell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
