import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { iconSrc } from './ItemIcon'
import { LAYER_INFO, type LayerKey, type MarkerData } from './markers'
import { KIND_LABEL, searchPlaces, type Place } from './places'

interface Props {
  data: MarkerData | null
  on: Record<LayerKey, boolean>
  setOn: (v: Record<LayerKey, boolean>) => void
  places: Place[]
  selected: Place | null
  onPick: (p: Place | null) => void
}

/** Fixed bar at the top-center of the map: layer toggles (icons) + quick place search on the right. */
export default function LayersBar({ data, on, setOn, places, selected, onPick }: Props) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const results = useMemo(() => (q.trim() ? searchPlaces(places, q).slice(0, 8) : []), [places, q])

  const pick = (p: Place) => {
    onPick(p)
    setQ(p.n)
    setOpen(false)
  }
  const clear = () => {
    setQ('')
    setOpen(false)
    onPick(null)
  }

  return (
    <div className="layersbar glass">
      {LAYER_INFO.map(({ key, label }) => (
        <button key={key} className={`lbtn ${on[key] ? 'on' : ''}`} title={`${label} ${data?.[key].length ?? 0}`} onClick={() => setOn({ ...on, [key]: !on[key] })}>
          {data && <img src={iconSrc(data.icons[key])} alt={label} />}
        </button>
      ))}
      <div className="lsearch">
        <input
          placeholder="장소 검색"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) pick(results[0])
            if (e.key === 'Escape') clear()
          }}
        />
        {(q || selected) && (
          <button className="lclear" title="지우기" onMouseDown={(e) => e.preventDefault()} onClick={clear}>
            <X size={14} />
          </button>
        )}
        {open && results.length > 0 && (
          <div className="lres glass">
            {results.map((p) => (
              <div key={p.key} className="lrow" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)}>
                <img className={p.round ? 'rd' : ''} src={iconSrc(p.icon)} alt="" />
                <span className="pn">{p.n}</span>
                <span className="pm">{p.lv ? `Lv.${p.lv} · ` : ''}{KIND_LABEL[p.k]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
