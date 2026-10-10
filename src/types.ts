export interface Material {
  id: string
  qty: number
}

export interface Item {
  id: string
  code: string
  name: string
  icon: string
  desc: string
  typeA?: string | null
  typeB?: string | null
  rarity: number
  recipe?: Material[]
  bench?: string[]
}

export interface PalIconRef {
  icon: string
  name: string
  lv?: number
}

export interface Pal {
  id: string
  code: string
  no: string
  name: string
  icon: string
  elements: PalIconRef[]
  works: PalIconRef[]
  stats: Record<string, string>
  egg?: string | null
  partner?: { name: string; desc: string }
  drops: { id: string; qty: string; prob: string }[]
  zones: { lv: string; code: string }[]
  hasSpawn?: boolean
}

export interface Struct {
  id: string
  name: string
  icon: string
  desc: string
  cat: string
  techLv: number | null
  san: string | null
  works?: { icon: string; lv: number }[]
  mats: Material[]
  tech?: { lv: number | null; cost: number; ancient: boolean }
}

export interface SpawnData {
  d: [number, number, number][]
  n: [number, number, number][]
}

/** Anything that can be listed in the left panel. */
export interface Entry {
  id: string
  name: string
  icon: string
  rarity?: number
  /** small right-aligned text for leaves (tree) / path (list) */
  sub?: string
  /** optional sort key inside tree folders (e.g. dex number) */
  order?: number
  /** folder paths per grouping key; an entry may live in several folders */
  paths: Record<string, string[][]>
}

export interface TreeNode {
  key: string
  name: string
  children?: TreeNode[]
  item?: Entry
  count: number
}
