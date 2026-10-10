export const RARITY = ['일반', '비범', '희귀', '영웅', '전설']

export const iconSrc = (name: string) => `${import.meta.env.BASE_URL}icons/${name}`

interface Props {
  icon?: string
  rarity?: number
  size?: number
}

/** Rounded icon with a rarity gradient (bright at bottom). rarity undefined = neutral. */
export default function ItemIcon({ icon, rarity, size = 28 }: Props) {
  return (
    <span className="ico" data-r={rarity} style={{ width: size, height: size }}>
      {icon && <img src={iconSrc(icon)} alt="" loading="lazy" />}
    </span>
  )
}
