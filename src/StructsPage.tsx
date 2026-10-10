import { useMemo } from 'react'
import BackBar from './BackBar'
import Browser from './Browser'
import { structEntries, type Catalog } from './data'
import ItemIcon, { iconSrc } from './ItemIcon'
import { tip } from './Tooltip'
import type { Go } from './MatTable'
import RecipeTree from './RecipeTree'
import type { Struct } from './types'

export function StructsList({ catalog, selId, go }: { catalog: Catalog | null; selId: string | null; go: Go }) {
  const entries = useMemo(() => structEntries(catalog?.structs ?? []), [catalog])
  return (
    <Browser
        catalog={catalog}
        storeKey="structs"
        entries={entries}
        groupings={[{ key: 'cat', label: '건설 분류' }]}
        selId={selId}
        onSelect={(id) => go('structs', id)}
        placeholder="구조물 검색 (예: 작업대)"
        unit="개"
        rootName="전체 구조물"
      />
  )
}

/** Route-driven screen (mobile): list, or detail when something is selected. */
export default function StructsPage({ catalog, selId, go }: { catalog: Catalog | null; selId: string | null; go: Go }) {
  const sel = selId ? catalog?.structById.get(selId) : undefined
  return (
    <>
      <StructsList catalog={catalog} selId={selId} go={go} />
      {selId && <StructDetail s={sel} catalog={catalog} go={go} />}
    </>
  )
}

export function StructDetail({ s, catalog, go }: { s?: Struct; catalog: Catalog | null; go: Go }) {
  const makes = useMemo(() => (s && catalog ? catalog.items.filter((i) => i.bench?.includes(s.name)) : []), [s, catalog])
  if (!s || !catalog) return <div className="detail"><p className="empty">{catalog ? '목록에서 구조물을(를) 선택하세요' : '불러오는 중…'}</p></div>
  const t = s.tech
  return (
    <div className="detail">
      <BackBar page="structs" go={go} />
      <div className="head">
        <div className="big"><ItemIcon icon={s.icon} size={88} /></div>
        <div>
          <h2>{s.name}</h2>
          <div className="tags">
            <span className="tag">{s.cat}</span>
            {t?.ancient && <span className="tag">고대 기술</span>}
          </div>
        </div>
      </div>
      <p className="desc">{s.desc}</p>
      <div className="pts">
        <div className="pt"><b>{s.techLv ? `Lv.${s.techLv}` : t?.lv ? `Lv.${t.lv}` : '-'}</b><span>요구 기술 레벨</span></div>
        <div className="pt"><b>{t && !t.ancient ? t.cost : t ? 0 : '-'}</b><span>기술 포인트</span></div>
        <div className="pt"><b>{t?.ancient ? t.cost : t ? 0 : '-'}</b><span>고대 기술 포인트</span></div>
      </div>
      {!t && <p className="desc" style={{ marginTop: -8 }}>기술 트리에 별도 항목이 없는 구조물 (기본 해금 또는 다른 경로로 획득)</p>}
      {s.mats.length > 0 && <RecipeTree goalKey={`struct:${s.id}`} roots={s.mats.map((m) => [m.id, m.qty])} catalog={catalog} go={go} title="조합식 (건설 재료)" />}
      <div className="boxes">
        <div className="box">
          <h3>요구 적성 / 기타</h3>
          <div className="works">
            {s.works?.length ? s.works.map((w, i) => (
              <span className="work" key={i} title={`요구 적성 Lv.${w.lv}`}><img src={iconSrc(w.icon)} alt="" /><b>{w.lv}</b></span>
            )) : <span className="tag">없음</span>}
          </div>
          {s.san && <p className="desc" style={{ margin: '10px 0 0' }}>SAN {s.san}</p>}
        </div>
      </div>
      {makes.length > 0 && (
        <div className="box">
          <h3>여기서 만들 수 있는 아이템 ({makes.length})</h3>
          <div className="chips">
            {makes.map((i) => (
              <a className="chip" key={i.id} {...tip('item', i.id)} onClick={() => go('items', i.id)}>
                <ItemIcon icon={i.icon} rarity={i.rarity} size={22} />
                {i.name}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
