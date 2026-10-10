import { useMemo, useState } from 'react'
import { buildTree, filterTree, uniqueCount } from './data'
import { folderIcon } from './folderIcons'
import ItemIcon, { iconSrc } from './ItemIcon'
import type { Catalog } from './data'
import type { Entry, TreeNode } from './types'
import { useStored } from './useStored'

type Mode = 'tree' | 'list' | 'grid'

const MODES: Record<Mode, { title: string; svg: React.ReactNode }> = {
  tree: { title: '계층 보기', svg: <path d="M2 3h5M5 8h8M5 13h8M3 3v10M3 8h2M3 13h2" /> },
  list: { title: '목록 보기 (가나다순)', svg: <path d="M2 3.5h12M2 8h12M2 12.5h12" /> },
  grid: {
    title: '그리드 보기 (가나다순)',
    svg: (
      <>
        <rect x="2" y="2" width="5" height="5" />
        <rect x="9" y="2" width="5" height="5" />
        <rect x="2" y="9" width="5" height="5" />
        <rect x="9" y="9" width="5" height="5" />
      </>
    ),
  },
}

function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q) : -1
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

interface Props {
  /** unique per page, used for remembering the view mode / grouping */
  storeKey: string
  entries: Entry[]
  groupings: { key: string; label: string }[]
  selId: string | null
  onSelect: (id: string) => void
  placeholder: string
  unit: string
  /** shown in tree folders as "N<unit>" */
  rootName?: string
  catalog: Catalog | null
}

export default function Browser({ storeKey, entries, groupings, selId, onSelect, placeholder, unit, rootName, catalog }: Props) {
  const [q, setQ] = useState('')
  const [mode, setMode] = useStored<Mode>(`ui.mode.${storeKey}`, 'tree')
  const [group, setGroup] = useStored<string>(`ui.group.${storeKey}`, groupings[0].key)
  const [open, setOpen] = useState<Set<string>>(new Set(['root']))

  const groupKey = groupings.some((g) => g.key === group) ? group : groupings[0].key
  const tree = useMemo(() => buildTree(entries, groupKey, rootName), [entries, groupKey, rootName])
  const sorted = useMemo(() => [...entries].sort((a, b) => a.name.localeCompare(b.name, 'ko')), [entries])
  const query = q.trim().toLowerCase()
  const shown = useMemo(() => filterTree(tree, query), [tree, query])
  const matches = useMemo(() => (query ? sorted.filter((e) => e.name.toLowerCase().includes(query)) : sorted), [sorted, query])
  const count = mode === 'tree' ? (shown ? uniqueCount(shown) : 0) : matches.length

  const toggle = (key: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })

  const renderNode = (n: TreeNode, parent?: string) => {
    const isDir = !!n.children
    const isOpen = isDir && (!!query || n.key === 'root' || open.has(n.key))
    return (
      <div className="node" key={n.key}>
        <div
          className={`row ${n.item && n.item.id === selId ? 'sel' : ''}`}
          onClick={() => (isDir ? toggle(n.key) : onSelect(n.item!.id))}
        >
          <span className="arrow">{isDir ? (isOpen ? '▼' : '▶') : ''}</span>
          {n.item ? <ItemIcon icon={n.item.icon} rarity={n.item.rarity} /> : folderIcon(n.name, parent, catalog, n.key === 'root')}
          <span className="name"><Highlight text={n.name} q={query} /></span>
          {isDir ? <span className="cnt">{n.count}{unit}</span> : n.item?.sub && <span className="cnt">{n.item.sub}</span>}
        </div>
        {isOpen && <div className="kids">{n.children!.map((c) => renderNode(c, n.key === 'root' ? undefined : n.name))}</div>}
      </div>
    )
  }

  return (
    <div className="list">
      <div className="search">
        <input placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mode">
          {(Object.keys(MODES) as Mode[]).map((m) => (
            <button key={m} title={MODES[m].title} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                {MODES[m].svg}
              </svg>
            </button>
          ))}
        </div>
        {mode === 'tree' && groupings.length > 1 && (
          <div className="group">
            {groupings.map((g) => (
              <button key={g.key} className={g.key === groupKey ? 'on' : ''} onClick={() => setGroup(g.key)}>{g.label}</button>
            ))}
          </div>
        )}
        <small>{query ? `검색 결과: ${count}${unit}` : `전체 ${entries.length}${unit}${mode === 'tree' ? ' · 폴더 옆 숫자 = 안에 든 개수' : ''}`}</small>
      </div>
      <div className="tree">
        {mode === 'tree' && (shown ? renderNode(shown) : <p className="empty">결과 없음</p>)}
        {mode === 'list' && (
          <div className="flat">
            {matches.map((e) => (
              <div key={e.id} className={`row ${e.id === selId ? 'sel' : ''}`} onClick={() => onSelect(e.id)}>
                <ItemIcon icon={e.icon} rarity={e.rarity} />
                <span className="name"><Highlight text={e.name} q={query} /></span>
                <span className="path">{e.sub}</span>
              </div>
            ))}
          </div>
        )}
        {mode === 'grid' && (
          <div className="grid">
            {matches.map((e) => (
              <div key={e.id} className={`tile ${e.id === selId ? 'sel' : ''}`} data-r={e.rarity} title={e.name} onClick={() => onSelect(e.id)}>
                <span className="timg"><img src={iconSrc(e.icon)} alt="" loading="lazy" /></span>
                <span className="tname"><Highlight text={e.name} q={query} /></span>
              </div>
            ))}
          </div>
        )}
        {mode !== 'tree' && matches.length === 0 && <p className="empty">결과 없음</p>}
      </div>
    </div>
  )
}
