import { useEffect, useState } from 'react'
import type { Catalog } from './data'
import ItemIcon, { RARITY, iconSrc } from './ItemIcon'
import { labelA, labelB } from './labels'

/** data-tip="item:Arrow" | "struct:Primitive_Workbench" | "pal:Lamball" on any element shows a summary card on hover. */
export const tip = (kind: 'item' | 'struct' | 'pal', id: string) => ({ 'data-tip': `${kind}:${id}` })

interface Shown {
  kind: string
  id: string
  x: number
  y: number
  flip: boolean
  touch?: boolean
  /** extra data copied from the element (map markers carry their own info) */
  data?: Record<string, string | undefined>
}

const W = 300

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trim()}…` : s)

export default function TooltipLayer({ catalog }: { catalog: Catalog | null }) {
  const [s, setS] = useState<Shown | null>(null)

  useEffect(() => {
    const find = (t: EventTarget | null) => (t as HTMLElement | null)?.closest?.('[data-tip]') as HTMLElement | null
    const place = (el: HTMLElement, touch: boolean): Shown => {
      const [kind, ...rest] = el.dataset.tip!.split(':')
      const r = el.getBoundingClientRect()
      const flip = r.bottom + 190 > innerHeight && r.top > 200
      return { kind, id: rest.join(':'), data: { ...el.dataset }, x: Math.max(8, Math.min(r.left, innerWidth - W - 8)), y: flip ? r.top - 8 : r.bottom + 8, flip, touch }
    }
    const canHover = matchMedia('(hover: hover)').matches
    const over = (e: MouseEvent) => {
      if (!canHover) return
      const el = find(e.target)
      setS(el ? place(el, false) : null)
    }
    const hide = () => setS(null)

    // touch: long press shows the card, a normal tap still navigates
    let timer: number | undefined
    let pressed = false
    const start = (e: TouchEvent) => {
      const el = find(e.target)
      pressed = false
      if (!el) return hide()
      timer = window.setTimeout(() => {
        pressed = true
        setS(place(el, true))
      }, 450)
    }
    const cancel = () => window.clearTimeout(timer)
    const end = () => {
      cancel()
      // a long press must not also trigger the click navigation
      if (pressed) {
        const swallow = (ev: Event) => (ev.stopPropagation(), ev.preventDefault())
        document.addEventListener('click', swallow, { capture: true, once: true })
        window.setTimeout(() => document.removeEventListener('click', swallow, true), 400)
      }
    }
    const hideOutside = (e: Event) => {
      if (!(e.target as HTMLElement).closest?.('.tip')) hide()
    }
    document.addEventListener('mouseover', over)
    document.addEventListener('scroll', hide, true)
    document.addEventListener('mousedown', hide)
    document.addEventListener('touchstart', start, { passive: true })
    document.addEventListener('touchmove', cancel, { passive: true })
    document.addEventListener('touchend', end)
    document.addEventListener('touchstart', hideOutside, { passive: true })
    return () => {
      document.removeEventListener('mouseover', over)
      document.removeEventListener('scroll', hide, true)
      document.removeEventListener('mousedown', hide)
      document.removeEventListener('touchstart', start)
      document.removeEventListener('touchmove', cancel)
      document.removeEventListener('touchend', end)
      document.removeEventListener('touchstart', hideOutside)
    }
  }, [])

  if (!s || (!catalog && s.kind !== 'marker')) return null
  const body = content(s, catalog)
  if (!body) return null
  return (
    <div className={`tip ${s.touch ? 'touch' : ''}`} style={{ left: s.x, top: s.y, width: W, transform: s.flip ? 'translateY(-100%)' : undefined }}>
      {body}
    </div>
  )
}

function Head({ icon, rarity, name, sub }: { icon: string; rarity?: number; name: string; sub: string }) {
  return (
    <div className="tip-head">
      <ItemIcon icon={icon} rarity={rarity} size={44} />
      <div>
        <b>{name}</b>
        <div className="sub">{sub}</div>
      </div>
    </div>
  )
}

function content(s: Shown, c: Catalog | null) {
  if (s.kind === 'marker') {
    const d = s.data ?? {}
    return (
      <>
        <div className="tip-head">
          <span className={`tip-mark ${d.mround ? 'round' : ''}`}><img src={iconSrc(d.micon ?? '')} alt="" /></span>
          <div>
            <b>{d.mname}</b>
            <div className="sub">{d.mlabel}{d.mlv ? ` · Lv.${d.mlv}` : ''}</div>
          </div>
        </div>
        {d.mnote && <p style={{ margin: 0 }}>{d.mnote}</p>}
      </>
    )
  }
  if (!c) return null
  if (s.kind === 'item') {
    const it = c.itemById.get(s.id)
    if (!it) return null
    return (
      <>
        <Head icon={it.icon} rarity={it.rarity} name={it.name} sub={`${RARITY[it.rarity] ?? '일반'} · ${labelA(it.typeA)} › ${labelB(it.typeB)}`} />
        {it.desc && <p>{clip(it.desc, 110)}</p>}
        <div className="kv">
          {it.recipe ? (
            <>제작 재료: <span>{it.recipe.slice(0, 4).map((m) => `${c.itemById.get(m.id)?.name ?? m.id} ${m.qty}`).join(' · ')}{it.recipe.length > 4 ? ' …' : ''}</span></>
          ) : (
            '기본 재료 (제작 불가)'
          )}
          {it.bench?.length ? <><br />제작대: <span>{it.bench.slice(0, 3).join(', ')}</span></> : null}
        </div>
      </>
    )
  }
  if (s.kind === 'struct') {
    const st = c.structById.get(s.id)
    if (!st) return null
    const t = st.tech
    return (
      <>
        <Head icon={st.icon} name={st.name} sub={`구조물 · ${st.cat}`} />
        <p>{clip(st.desc, 110)}</p>
        <div className="kv">
          {st.techLv || t?.lv ? <>기술 Lv.<span>{st.techLv ?? t?.lv}</span></> : '기술 Lv 없음'}
          {t ? <> · {t.ancient ? '고대 기술 포인트' : '기술 포인트'} <span>{t.cost}</span></> : null}
        </div>
      </>
    )
  }
  if (s.kind === 'pal') {
    const p = c.palById.get(s.id)
    if (!p) return null
    return (
      <>
        <Head icon={p.icon} name={p.name} sub={`${p.no} · ${p.elements.map((e) => e.name).join(', ') || '무속성'}`} />
        {p.partner && <p>{p.partner.name}: {clip(p.partner.desc, 90)}</p>}
        <div className="kv tip-works">
          {p.works.map((w) => (
            <span className="work" key={w.name}><img src={iconSrc(w.icon)} alt={w.name} /><b>{w.lv}</b></span>
          ))}
        </div>
      </>
    )
  }
  return null
}
