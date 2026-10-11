import { useEffect, useState } from 'react'
import type { Entry, Item, Material, Pal, SpawnData, Struct, TreeNode } from './types'
import { labelA, labelB, TYPE_A } from './labels'
import { structPath, subCounts } from './structGroups'

const base = import.meta.env.BASE_URL

async function loadJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${base}data/${path}`)
    return res.ok ? await res.json() : fallback
  } catch {
    return fallback
  }
}

export interface Catalog {
  items: Item[]
  pals: Pal[]
  structs: Struct[]
  itemById: Map<string, Item>
  palById: Map<string, Pal>
  structById: Map<string, Struct>
  structByName: Map<string, Struct>
}

let cache: Promise<Catalog> | null = null

export function loadCatalog(): Promise<Catalog> {
  cache ??= Promise.all([
    loadJson<Item[]>('items.json', []),
    loadJson<Pal[]>('pals.json', []),
    loadJson<Struct[]>('structs.json', []),
  ]).then(([items, pals, structs]) => ({
    items,
    pals,
    structs,
    itemById: new Map(items.map((i) => [i.id, i])),
    palById: new Map(pals.map((p) => [p.id, p])),
    structById: new Map(structs.map((s) => [s.id, s])),
    structByName: new Map(structs.map((s) => [s.name, s])),
  }))
  return cache
}

export function useCatalog() {
  const [c, setC] = useState<Catalog | null>(null)
  useEffect(() => {
    loadCatalog().then(setC)
  }, [])
  return c
}

const spawnCache = new Map<string, Promise<SpawnData | null>>()
export function loadSpawns(id: string) {
  if (!spawnCache.has(id)) spawnCache.set(id, loadJson<SpawnData | null>(`spawns/${id}.json`, null))
  return spawnCache.get(id)!
}

// ---- entries (what the left panel lists) ----

export const itemEntries = (items: Item[]): Entry[] =>
  items.map((i) => ({
    id: i.id,
    name: i.name,
    icon: i.icon,
    rarity: i.rarity,
    sub: `${labelA(i.typeA)} › ${labelB(i.typeB)}`,
    paths: { hier: [[labelA(i.typeA), labelB(i.typeB)]] },
  }))

/** '#5B' -> 5.1 so variants sort right after the base pal */
const dexOrder = (no: string, fallback: number) => {
  const m = /#(\d+)([A-Z]?)/.exec(no)
  return m ? +m[1] + (m[2] ? (m[2].charCodeAt(0) - 64) / 10 : 0) : 10000 + fallback
}

export const palEntries = (pals: Pal[]): Entry[] =>
  pals.map((p, idx) => ({
    id: p.id,
    name: p.name,
    icon: p.icon,
    sub: p.no,
    order: dexOrder(p.no, idx),
    paths: {
      element: (p.elements.length ? p.elements : [{ icon: '', name: '무속성' }]).map((e) => [e.name]),
      work: p.works.length ? p.works.map((w) => [w.name]) : [['작업 적성 없음']],
    },
  }))

export const structEntries = (structs: Struct[]): Entry[] => {
  const subs = subCounts(structs)
  return structs.map((s) => ({
    id: s.id,
    name: s.name,
    icon: s.icon,
    sub: s.techLv ? `Lv.${s.techLv}` : '',
    paths: { cat: [structPath(s, subs)] },
  }))
}

// ---- tree ----

export function buildTree(entries: Entry[], groupKey: string, rootName = '전체'): TreeNode {
  const root: TreeNode = { key: 'root', name: rootName, children: [], count: 0 }
  const folders = new Map<string, TreeNode>()
  for (const e of entries) {
    for (const path of e.paths[groupKey] ?? [['기타']]) {
      let parent = root
      path.forEach((seg, depth) => {
        const k = `d:${path.slice(0, depth + 1).join('/')}`
        let n = folders.get(k)
        if (!n) {
          n = { key: k, name: seg, children: [], count: 0 }
          folders.set(k, n)
          parent.children!.push(n)
        }
        parent = n
      })
      parent.children!.push({ key: `i:${path.join('/')}/${e.id}`, name: e.name, item: e, count: 1 })
    }
  }
  const cmp = (x: TreeNode, y: TreeNode) => x.name.localeCompare(y.name, 'ko')
  const order = Object.values(TYPE_A)
  const rank = (n: TreeNode) => (order.includes(n.name) ? order.indexOf(n.name) : order.length)
  const fin = (n: TreeNode): number => {
    if (!n.children) return 1
    const leaves = n.children.every((c) => !c.children)
    n.children.sort(
      n === root && groupKey === 'hier'
        ? (x, y) => rank(x) - rank(y) || cmp(x, y)
        : leaves
          ? (x, y) => (x.item?.order ?? 0) - (y.item?.order ?? 0) || cmp(x, y)
          : cmp,
    )
    n.count = n.children.reduce((s, c) => s + fin(c), 0)
    return n.count
  }
  fin(root)
  root.count = entries.length // entries can live in several folders; the root counts each once
  return root
}

/** Filter a tree by name; folders whose own name matches keep all children. */
export function filterTree(n: TreeNode, q: string): TreeNode | null {
  if (!q) return n
  if (!n.children) return n.name.toLowerCase().includes(q) ? n : null
  if (n.name.toLowerCase().includes(q) && n.key !== 'root') return n
  const kids = n.children.map((c) => filterTree(c, q)).filter(Boolean) as TreeNode[]
  if (!kids.length) return null
  return { ...n, children: kids, count: kids.reduce((s, c) => s + c.count, 0) }
}

export function uniqueCount(n: TreeNode): number {
  const ids = new Set<string>()
  const walk = (x: TreeNode) => (x.children ? x.children.forEach(walk) : x.item && ids.add(x.item.id))
  walk(n)
  return ids.size
}

/** Expand a recipe down to base materials (items without a recipe). */
export function baseMaterials(id: string, qty: number, byId: Map<string, Item>, acc = new Map<string, number>(), depth = 0) {
  const it = byId.get(id)
  if (!it?.recipe || depth > 12) {
    acc.set(id, (acc.get(id) ?? 0) + qty)
    return acc
  }
  for (const m of it.recipe as Material[]) baseMaterials(m.id, m.qty * qty, byId, acc, depth + 1)
  return acc
}
