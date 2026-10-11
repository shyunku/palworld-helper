import type { Struct } from './types'

/** Game sub category (TypeB) -> Korean folder name. Only used for folders that have more than one. */
const SUB_LABEL: Record<string, string> = {
  Prod_Craft: '제작대',
  Prod_Resource: '자원 생산',
  Prod_Furnace: '화로·제련',
  Prod_Medicine: '제약',
  Pal_Capture: '스피어 제작',
  Pal_Breed: '교배·사육',
  Pal_Modify: '팰 개조',
  Infra_Storage: '보관함',
  Infra_Environment: '일반 시설',
  Infra_GeneratePower: '발전',
  Infra_Medical: '침대·의료',
  Infra_Defense: '방어 시설',
  Food_Basic: '식량·조리',
  Food_Agriculture: '농업',
  ConsumeOther: '기타',
  Other: '기타',
}

/** Ordered keyword rules: the first rule whose keyword is in the name wins. */
type Rule = [label: string, words: string[]]

// 건축: material first, then the building part
const MATERIALS: Rule[] = [
  ['일본식', ['일본식', 'Japanese']],
  ['미래식', ['미래식']],
  ['고대', ['고대']],
  ['유리', ['유리']],
  ['금속', ['금속']],
  ['돌', ['돌']],
  ['나무', ['나무']],
]
const PARTS: Rule[] = [
  ['토대', ['토대', 'Foundation']],
  ['지붕', ['지붕', 'Roof']],
  ['벽', ['벽', 'Wall']],
  ['계단', ['계단', 'Stairs']],
  ['문·출입구', ['문', '출입구', 'Door']],
  ['기둥', ['기둥', 'Pillar']],
  ['울타리', ['울타리', 'Fence']],
  ['사다리', ['사다리']],
]

// 가구: what kind of furniture / decoration
const FURNITURE: Rule[] = [
  ['모형', ['모형']],
  ['앤티크 세트', ['앤티크']],
  ['의자·소파', ['의자', '소파', '벤치', '스툴']],
  ['탁자·책상', ['탁자', '책상', '원탁', '테이블', '카운터']],
  ['깃발·표식·간판', ['깃발', '휘장', '표식', '간판', '현수막']],
  ['식물·조경', ['관엽식물', '덤불', '담쟁이', '화분', '식물', '분재', '생화']],
  ['석상·조각', ['석상', '상', '석등롱']],
  ['악기·가전·오락', ['피아노', '티비', '자판기', '인형뽑기', '아케이드', '축구', '시계']],
  ['도로·공사', ['드럼통', '삼각콘', '신호기', '타이어', '토관', '쓰레기봉투', '케이블']],
  ['일본풍 장식', ['병풍', '족자', '방석', '이로리', '시시오도시', '향로', '독서대']],
  ['카펫', ['카펫', '러그', '매트']],
  ['바리케이드', ['바리케이드', '철조망', '울타리']],
  ['선반·수납장', ['선반', '캐비닛', '서랍', '수납']],
  ['침대', ['침대']],
]

const pick = (rules: Rule[], name: string, fallback: string) => rules.find(([, w]) => w.some((x) => name.includes(x)))?.[0] ?? fallback

/** Folder path of a structure in the tree (below the game's build category). */
export function structPath(s: Struct, siblingSubs: Map<string, number>): string[] {
  if (s.cat === '건축') return [s.cat, pick(MATERIALS, s.name, '기타 재질'), pick(PARTS, s.name, '기타')]
  if (s.cat === '가구') return [s.cat, pick(FURNITURE, s.name, '기타')]
  // game sub category, but only when the category really has more than one (otherwise it is just noise)
  if ((siblingSubs.get(s.cat) ?? 0) > 1) return [s.cat, SUB_LABEL[s.typeB ?? ''] ?? '기타']
  return [s.cat]
}

/** number of distinct sub categories per build category */
export function subCounts(structs: Struct[]): Map<string, number> {
  const sets = new Map<string, Set<string>>()
  for (const s of structs) {
    const label = SUB_LABEL[s.typeB ?? ''] ?? '기타'
    sets.set(s.cat, (sets.get(s.cat) ?? new Set()).add(label))
  }
  return new Map([...sets].map(([k, v]) => [k, v.size]))
}
