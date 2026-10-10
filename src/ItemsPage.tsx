import { useMemo } from 'react'
import BackBar from './BackBar'
import Browser from './Browser'
import { itemEntries, type Catalog } from './data'
import ItemIcon, { RARITY } from './ItemIcon'
import { labelA, labelB } from './labels'
import { tip } from './Tooltip'
import type { Go } from './MatTable'
import RecipeTree from './RecipeTree'
import type { Item } from './types'

export function ItemsList({ catalog, selId, go }: { catalog: Catalog | null; selId: string | null; go: Go }) {
  const entries = useMemo(() => itemEntries(catalog?.items ?? []), [catalog])
  return (
    <Browser
        catalog={catalog}
        storeKey="items"
        entries={entries}
        groupings={[{ key: 'hier', label: '분류' }]}
        selId={selId}
        onSelect={(id) => go('items', id)}
        placeholder="아이템 검색 (예: 금속)"
        unit="개"
      />
  )
}

/** Route-driven screen (mobile): list, or detail when something is selected. */
export default function ItemsPage({ catalog, selId, go }: { catalog: Catalog | null; selId: string | null; go: Go }) {
  const sel = selId ? catalog?.itemById.get(selId) : undefined
  return (
    <>
      <ItemsList catalog={catalog} selId={selId} go={go} />
      {selId && <ItemDetail item={sel} catalog={catalog} go={go} />}
    </>
  )
}

export function ItemDetail({ item, catalog, go }: { item?: Item; catalog: Catalog | null; go: Go }) {
  if (!item || !catalog) return <div className="detail"><p className="empty">{catalog ? '목록에서 아이템을(를) 선택하세요' : '불러오는 중…'}</p></div>
  return (
    <div className="detail">
      <BackBar page="items" go={go} />
      <div className="head">
        <div className="big"><ItemIcon icon={item.icon} rarity={item.rarity} size={88} /></div>
        <div>
          <h2>{item.name}</h2>
          <div className="tags">
            <span className={`rname rn${item.rarity}`}>{RARITY[item.rarity] ?? '일반'}</span>
            <span className="tag">{labelA(item.typeA)} › {labelB(item.typeB)}</span>
            {item.bench?.map((b) => {
              const s = catalog.structByName.get(b)
              return s ? (
                <a className="tag link" key={b} {...tip('struct', s.id)} onClick={() => go('structs', s.id)}>{b} ↗</a>
              ) : (
                <span className="tag" key={b}>{b}</span>
              )
            })}
          </div>
        </div>
      </div>
      {item.desc && <p className="desc">{item.desc}</p>}
      {item.recipe ? (
        <RecipeTree goalKey={`item:${item.id}`} roots={item.recipe.map((m) => [m.id, m.qty])} catalog={catalog} go={go} />
      ) : (
        <div className="box"><h3>제작 재료</h3>제작 레시피가 없는 아이템 (채집/드롭/구매 등으로 획득)</div>
      )}
    </div>
  )
}
