import { useMemo, useState } from 'react'
import { iconSrc } from './ItemIcon'
import { LAYER_INFO, type LayerKey, type MarkerData } from './markers'
import { KIND_LABEL, searchPlaces, type Place } from './places'

const MAX_ROWS = 60

function Mark({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

/** "장소" window: search places by name, filter by kind, click to show it on the map. */
export default function PlacesPanel({ data, places, selected, onSelect }: { data: MarkerData | null; places: Place[]; selected: Place | null; onSelect: (p: Place | null) => void }) {
  const [q, setQ] = useState('')
  const [kinds, setKinds] = useState<Set<LayerKey>>(new Set(LAYER_INFO.map((l) => l.key)))
  const query = q.trim()
  const found = useMemo(() => searchPlaces(places, query, kinds), [places, query, kinds])
  const toggleKind = (k: LayerKey) =>
    setKinds((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  return (
    <div className="places">
      <div className="places-search">
        <input placeholder="장소 검색 (예: 동굴, 섬, 이시스)" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="places-chips">
        {LAYER_INFO.map(({ key, label }) => (
          <span key={key} className={`pchip ${kinds.has(key) ? 'on' : ''}`} onClick={() => toggleKind(key)}>
            {data && <img src={iconSrc(data.icons[key])} alt="" />}
            {label} <b>{data?.[key].length ?? 0}</b>
          </span>
        ))}
      </div>
      <div className="places-list">
        {found.slice(0, MAX_ROWS).map((p) => (
          <div key={p.key} className={`prow ${selected?.key === p.key ? 'sel' : ''}`} onClick={() => onSelect(selected?.key === p.key ? null : p)}>
            <img className={p.round ? 'rd' : ''} src={iconSrc(p.icon)} alt="" loading="lazy" />
            <span className="pn"><Mark text={p.n} q={query} /></span>
            <span className="pm">{p.lv ? `Lv.${p.lv} · ` : ''}{KIND_LABEL[p.k]}</span>
          </div>
        ))}
        {found.length === 0 && <p className="empty">결과 없음</p>}
      </div>
      <div className="places-foot">검색 결과 {found.length}곳{found.length > MAX_ROWS ? ` (상위 ${MAX_ROWS}개 표시)` : ''}</div>
    </div>
  )
}
