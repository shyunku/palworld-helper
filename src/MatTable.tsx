import ItemIcon from './ItemIcon'
import { tip } from './Tooltip'
import type { Item } from './types'

export type Go = (page: 'map' | 'items' | 'pals' | 'structs', id?: string | null) => void

/** Clickable material table; every row jumps to that item. */
export default function MatTable({ title, head, rows, byId, go, extra }: {
  title: string
  head: string
  rows: [string, number | string][]
  byId: Map<string, Item>
  go: Go
  extra?: React.ReactNode
}) {
  return (
    <div className="box">
      <h3>{title}</h3>
      {extra}
      <table>
        <thead><tr><th /><th>{head}</th><th className="n">수량</th></tr></thead>
        <tbody>
          {rows.map(([id, c]) => {
            const mi = byId.get(id)
            return (
              <tr key={id} className="go" {...(mi ? tip('item', id) : {})} onClick={() => mi && go('items', id)}>
                <td><ItemIcon icon={mi?.icon} rarity={mi?.rarity} /></td>
                <td>{mi?.name ?? id}{mi?.recipe && head === '재료' && <span className="tag">제작 가능</span>}</td>
                <td className="n">{c}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
