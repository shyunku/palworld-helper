import { iconSrc } from './ItemIcon'
import { LAYER_INFO, type LayerKey, type MarkerData } from './markers'

/** Fixed icon bar at the top-center of the map: toggles marker layers (hover = name + count). */
export default function LayersBar({ data, on, setOn }: { data: MarkerData | null; on: Record<LayerKey, boolean>; setOn: (v: Record<LayerKey, boolean>) => void }) {
  return (
    <div className="layersbar glass">
      {LAYER_INFO.map(({ key, label }) => (
        <button key={key} className={`lbtn ${on[key] ? 'on' : ''}`} title={`${label} ${data?.[key].length ?? 0}`} onClick={() => setOn({ ...on, [key]: !on[key] })}>
          {data && <img src={iconSrc(data.icons[key])} alt={label} />}
        </button>
      ))}
    </div>
  )
}
