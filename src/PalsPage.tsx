import { useMemo } from 'react'
import BackBar from './BackBar'
import Browser from './Browser'
import { palEntries, type Catalog } from './data'
import ItemIcon, { iconSrc } from './ItemIcon'
import type { Go } from './MatTable'
import { tip } from './Tooltip'
import type { Pal } from './types'

export interface SpawnCtl {
  time: 'd' | 'n'
  setTime: (t: 'd' | 'n') => void
  count: number
}

export function PalsList({ catalog, selId, go }: { catalog: Catalog | null; selId: string | null; go: Go }) {
  const entries = useMemo(() => palEntries(catalog?.pals ?? []), [catalog])
  return (
    <Browser
        catalog={catalog}
        storeKey="pals"
        entries={entries}
        groupings={[
          { key: 'element', label: '속성별' },
          { key: 'work', label: '작업 적성별' },
        ]}
        selId={selId}
        onSelect={(id) => go('pals', id)}
        placeholder="팰 검색 (예: 도로롱)"
        unit="마리"
        rootName="전체 팰"
      />
  )
}

/** Route-driven screen (mobile): list, or detail when something is selected. */
export default function PalsPage({ catalog, selId, go, spawn }: { catalog: Catalog | null; selId: string | null; go: Go; spawn: SpawnCtl }) {
  const sel = selId ? catalog?.palById.get(selId) : undefined
  return (
    <>
      <PalsList catalog={catalog} selId={selId} go={go} />
      {selId && <PalDetail pal={sel} catalog={catalog} go={go} spawn={spawn} />}
    </>
  )
}

export function PalDetail({ pal, catalog, go, spawn }: { pal?: Pal; catalog: Catalog | null; go: Go; spawn: SpawnCtl }) {
  const { time, setTime, count } = spawn
  if (!pal || !catalog) return <div className="detail"><p className="empty">{catalog ? '목록에서 팰을(를) 선택하세요' : '불러오는 중…'}</p></div>
  const zones = pal.zones.filter((z) => z.lv)
  return (
    <div className="detail">
      <BackBar page="pals" go={go} />
      <div className="head">
        <div className="big"><ItemIcon icon={pal.icon} size={88} /></div>
        <div>
          <h2>{pal.name} <span className="no">{pal.no}</span></h2>
          <div className="tags">
            {pal.elements.map((e) => (
              <span className="el" key={e.name}><img src={iconSrc(e.icon)} alt="" />{e.name}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="boxes">
        <div className="box">
          <h3>스탯 / 작업 적성</h3>
          <table>
            <tbody>
              {['HP', '공격', '방어', '작업 속도', '식사량'].map((k) =>
                pal.stats[k] ? (
                  <tr key={k}><td>{k}</td><td className="n">{pal.stats[k]}</td></tr>
                ) : null,
              )}
            </tbody>
          </table>
          <div className="works">
            {pal.works.length ? pal.works.map((w) => (
              <span className="work" key={w.name} title={`${w.name} Lv.${w.lv}`}><img src={iconSrc(w.icon)} alt={w.name} /><b>{w.lv}</b></span>
            )) : <span className="tag">작업 적성 없음</span>}
          </div>
        </div>
        {pal.partner && (
          <div className="box">
            <h3>파트너 스킬: {pal.partner.name}</h3>
            <p className="desc" style={{ margin: 0 }}>{pal.partner.desc}</p>
          </div>
        )}
      </div>
      <div className="boxes">
        <div className="box">
          <h3>입수처</h3>
          {zones.length > 0 ? (
            <table>
              <thead><tr><th>서식 구역 (게임 내부 코드)</th><th className="n">레벨</th></tr></thead>
              <tbody>
                {zones.map((z, i) => (
                  <tr key={i}><td>{z.code}</td><td className="n">{z.lv}</td></tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="desc" style={{ margin: 0 }}>일반 서식지 정보가 없는 팰 (보스/이벤트/교배 등)</p>
          )}
          {pal.egg && <p className="desc" style={{ margin: '10px 0 0' }}>알: {pal.egg}</p>}
          {pal.drops.length > 0 && (
            <>
              <h3 style={{ marginTop: 14 }}>드롭 아이템</h3>
              <div className="chips">
                {pal.drops.map((d) => {
                  const it = catalog.itemById.get(d.id)
                  return (
                    <a className="chip" key={d.id} {...(it ? tip('item', d.id) : {})} onClick={() => it && go('items', d.id)}>
                      <ItemIcon icon={it?.icon} rarity={it?.rarity} size={22} />
                      {it?.name ?? d.id} <span className="mute">{d.qty} · {d.prob}</span>
                    </a>
                  )
                })}
              </div>
            </>
          )}
        </div>
        <div className="box">
          <h3>서식 분포 (지도에 표시 중)</h3>
          {pal.hasSpawn ? (
            <div className="mm-ctl">
              <div className="seg">
                <button className={time === 'd' ? 'on' : ''} onClick={() => setTime('d')}>낮</button>
                <button className={time === 'n' ? 'on' : ''} onClick={() => setTime('n')}>밤</button>
              </div>
              <span className="mute">{count}곳 · 지도가 자동으로 맞춰짐</span>
              <button className="linkbtn" onClick={() => go('map', pal.id)}>지도만 보기 →</button>
            </div>
          ) : (
            <p className="desc" style={{ margin: 0 }}>서식지 좌표 정보가 없는 팰</p>
          )}
        </div>
      </div>
    </div>
  )
}
