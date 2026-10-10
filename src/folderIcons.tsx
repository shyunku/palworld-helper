import {
  Anchor, Archive, Armchair, Beef, BookOpen, BrickWall, Bomb, Boxes, Carrot, CircleDot, Crosshair, Egg, Ellipsis, Factory,
  Fish, FlaskConical, Folder, Gem, HardHat, Heart, Lamp, Layers, Library, Mountain, PawPrint, Pill, PlugZap, Puzzle, ScrollText,
  Shield, ShieldHalf, Shirt, Star, Sword, Syringe, Target, TrendingUp, Trees, UtensilsCrossed, Wind, Coins, Zap,
  type LucideIcon,
} from 'lucide-react'
import { iconSrc } from './ItemIcon'
import type { Catalog } from './data'

const ICONS: Record<string, LucideIcon> = {
  // item main categories
  무기: Sword, 스피어: CircleDot, '팰 장비 무기': Sword, 방어구: Shield, 장신구: Gem, 탄약: Bomb, 글라이더: Wind,
  '스피어 모듈': Puzzle, 소모품: FlaskConical, '식재료·요리': UtensilsCrossed, 소재: Boxes, 귀중품: Star, 설계도: ScrollText,
  // item sub categories
  '근접 무기': Sword, 활: Target, 석궁: Target, '돌격 소총': Crosshair, 권총: Crosshair, 샷건: Crosshair, '저격 소총': Crosshair,
  '개틀링 건': Crosshair, '로켓 런처': Crosshair, 화염방사기: Zap, '투척 무기': Bomb, '그래플링 건': Anchor, 낚싯대: Fish,
  '금속 탐지기': Crosshair, '팰 스피어': CircleDot, '포획 로프': Anchor,
  '몸 방어구': Shirt, '머리 방어구': HardHat, 방패: ShieldHalf,
  '기술 서적': BookOpen, '고대 기술 서적': BookOpen, '기술 머신': BookOpen, '능력치 상승': TrendingUp, '팰 경험치': TrendingUp,
  '팰 레벨업': TrendingUp, '팰 랭크업': TrendingUp, '팰 재능 강화': TrendingUp, '작업 적성 강화': TrendingUp, '팰 부활': Heart,
  '팰 친밀도': Heart, 붕대: Syringe, 약: Pill, 약품: Pill,
  고기: Beef, '고기 요리': Beef, 채소: Carrot, '채소 요리': Carrot, 생선: Fish, '생선 요리': Fish, 가공식품: UtensilsCrossed,
  광석: Mountain, 석재: Mountain, 목재: Trees, 주괴: Layers, 보석: Gem, 알: Egg, '팰 드롭 소재': PawPrint, '가공 소재': Layers, 화폐: Coins,
  '팰 장비': PawPrint, '보스 보상': Star, 조명: Lamp, '인벤토리 확장': Archive,
  // structure categories
  건축: BrickWall, 생산: Factory, 수납: Archive, 인프라: PlugZap, 팰: PawPrint, 방어: ShieldHalf, 가구: Armchair, 식료품: UtensilsCrossed,
  기타: Ellipsis,
}

/** Folder icon: game icon for element / work folders, lucide for the rest (sub folders fall back to the parent's icon). */
export function folderIcon(name: string, parent: string | undefined, catalog: Catalog | null, isRoot: boolean) {
  if (isRoot) return <span className="fi"><Library size={16} strokeWidth={1.75} /></span>
  const game = gameIcon(name, catalog)
  if (game) return <span className="fi plain"><img src={iconSrc(game)} alt="" /></span>
  const Icon = ICONS[name] ?? (parent ? ICONS[parent] : undefined) ?? Folder
  return <span className="fi"><Icon size={16} strokeWidth={1.75} /></span>
}

const gameCache = new WeakMap<Catalog, Map<string, string>>()
function gameIcon(name: string, catalog: Catalog | null) {
  if (!catalog) return undefined
  let m = gameCache.get(catalog)
  if (!m) {
    m = new Map()
    for (const p of catalog.pals) for (const x of [...p.elements, ...p.works]) m.set(x.name, x.icon)
    gameCache.set(catalog, m)
  }
  return m.get(name)
}
