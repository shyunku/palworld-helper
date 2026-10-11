import { useMemo, useState } from 'react'
import type { Catalog } from './data'
import ItemIcon from './ItemIcon'
import type { Go } from './MatTable'
import { persistedStore } from './store'
import { tip } from './Tooltip'

const MAX_DEPTH = 12

/** holdings (itemId -> how many collected), shared by every recipe on screen */
const inventory = persistedStore<Record<string, number>>('ui.recipe.inventory', {})
/** goal count per entry (`item:<id>` / `struct:<id>`) */
const goals = persistedStore<Record<string, number>>('ui.recipe.goals', {})

interface Props {
  /** key the goal is saved under, e.g. `item:Metal_Detector` */
  goalKey: string
  /** direct materials of the item / structure being viewed: [itemId, qty per 1] */
  roots: [string, number][]
  catalog: Catalog
  go: Go
  title?: string
}

interface Node {
  key: string
  id: string
  qty: number
  /** how many are needed in total for the goal (after the parent's holdings were used) */
  need: number
  /** how many of `need` are covered by holdings */
  held: number
  kids: Node[]
}

/**
 * Crafting tree with a goal: materials of the viewed entry, then their own materials, and so on.
 * Holdings of intermediate items reduce what their sub-materials still need; holdings are used
 * from the top of the tree downwards, so an item that appears twice only counts its stock once.
 * Every row has a holding input; the value is shared by all rows of the same item.
 */
export default function RecipeTree({ goalKey, roots, catalog, go, title = '조합식 · 목표' }: Props) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [inv, setInv] = inventory.use()
  const [goalMap, setGoalMap] = goals.use()
  const goal = Math.max(1, goalMap[goalKey] ?? 1)
  const byId = catalog.itemById

  const { tree, baseNeed, baseHeld, openKinds, allKeys } = useMemo(() => {
    const pool = { ...inv }
    const keys: string[] = []
    const open = new Set<string>()
    let baseNeed = 0
    let baseHeld = 0
    const build = (id: string, qty: number, parentRem: number, path: string, depth: number): Node | null => {
      const it = byId.get(id)
      if (!it) return null
      const need = qty * parentRem
      const held = Math.min(pool[id] ?? 0, need)
      pool[id] = (pool[id] ?? 0) - held
      const key = `${path}/${id}`
      const rem = need - held
      const recipe = depth < MAX_DEPTH ? (it.recipe ?? []) : []
      if (!recipe.length) {
        baseNeed += need
        baseHeld += held
        if (rem > 0) open.add(id)
      } else keys.push(key)
      return {
        key,
        id,
        qty,
        need,
        held,
        kids: recipe.map((m) => build(m.id, m.qty, rem, key, depth + 1)).filter(Boolean) as Node[],
      }
    }
    const tree = roots.map(([id, q]) => build(id, q, goal, 'r', 0)).filter(Boolean) as Node[]
    return { tree, baseNeed, baseHeld, openKinds: open.size, allKeys: keys }
  }, [roots, inv, goal, byId])

  const toggle = (key: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })

  const percent = baseNeed ? Math.round((baseHeld / baseNeed) * 100) : 0
  const setHave = (id: string, v: number) => setInv({ ...inv, [id]: Math.max(0, Math.floor(v) || 0) })

  const row = (n: Node): React.ReactNode => {
    const it = byId.get(n.id)!
    const isOpen = open.has(n.key)
    const rem = n.need - n.held
    const done = rem === 0
    const pct = n.need ? Math.round((n.held / n.need) * 100) : 100
    return (
      <div key={n.key}>
        <div className="rt-item" {...tip('item', n.id)}>
          <div className="rt-row">
            <span className={`rt-arrow ${n.kids.length ? 'can' : ''}`} onClick={() => n.kids.length && toggle(n.key)}>
              {n.kids.length ? (isOpen ? '▼' : '▶') : ''}
            </span>
            <span className="rt-name" onClick={() => go('items', n.id)}>
              <ItemIcon icon={it.icon} rarity={it.rarity} size={24} />
              <span className="rt-text">{it.name}</span>
            </span>
            <span className="rt-q">×{n.qty}</span>
            <span className="rt-t">{n.need}</span>
            <span className="rt-have">
              <input
                type="number"
                min={0}
                value={inv[n.id] ?? 0}
                title="같은 재료는 어느 줄에서 고쳐도 같은 보유량을 공유해요. 계산은 위에서부터 차례로 사용해요."
                onChange={(e) => setHave(n.id, +e.target.value)}
                onFocus={(e) => e.target.select()}
              />
            </span>
            <span className={`rt-left ${done ? 'ok' : ''}`}>{done ? '✓' : rem}</span>
          </div>
          <div className={`rt-bar ${done ? 'done' : ''}`}><i style={{ width: `${pct}%` }} /></div>
        </div>
        {n.kids.length > 0 && isOpen && <div className="rt-kids">{n.kids.map(row)}</div>}
      </div>
    )
  }

  return (
    <div className="box">
      <div className="rt-head">
        <h3>{title}</h3>
        <button onClick={() => setOpen(new Set(allKeys))}>모두 펼치기</button>
        <button onClick={() => setOpen(new Set())}>모두 접기</button>
      </div>
      <div className="rt-goal">
        목표
        <input type="number" min={1} value={goal} onChange={(e) => setGoalMap({ ...goalMap, [goalKey]: Math.max(1, Math.floor(+e.target.value) || 1) })} />
        개 만들기
        <button
          className="rt-reset"
          title="입력한 보유량을 모두 지웁니다 (모든 조합식에 공통)"
          onClick={() => window.confirm('입력한 보유량을 모두 초기화할까요?') && setInv({})}
        >
          보유량 초기화
        </button>
      </div>
      <div className="rt-sum">
        <div className="rt-sumtext">
          <span>전체 진행 <b>{percent}%</b></span>
          <span>남은 재료 <b>{openKinds}</b>종</span>
        </div>
        <div className={`rt-bar big ${percent === 100 ? 'done' : ''}`}><i style={{ width: `${percent}%` }} /></div>
      </div>
      <div className="rt-cols">
        <span>재료</span>
        <span>×수량</span>
        <span>필요</span>
        <span>보유</span>
        <span>남음</span>
      </div>
      {tree.map(row)}
    </div>
  )
}
