import { useEffect, useState } from 'react'

/** Temporary diagnostics (?debug=blur): switch off suspects one by one to find what breaks backdrop-filter. */
const SUSPECTS: { cls: string; label: string }[] = [
  { cls: 'dbg-noshadow', label: '창 그림자(box-shadow) 끄기' },
  { cls: 'dbg-notextshadow', label: '글자 그림자(text-shadow) 끄기' },
  { cls: 'dbg-nomarkers', label: '지도 마커(drop-shadow 필터) 숨기기' },
  { cls: 'dbg-nomapoverlay', label: '지도 위 어둠 오버레이 끄기' },
  { cls: 'dbg-notransition', label: '창/지도 transition 끄기' },
  { cls: 'dbg-nochildopacity', label: '뒤 창 내용 opacity 끄기' },
  { cls: 'dbg-nooverflow', label: '창 overflow:hidden 끄기' },
  { cls: 'dbg-noradius', label: '창 둥근 모서리 끄기' },
]

export default function BlurDebug() {
  const [on, setOn] = useState<Set<string>>(new Set())
  useEffect(() => {
    SUSPECTS.forEach((s) => document.documentElement.classList.toggle(s.cls, on.has(s.cls)))
  }, [on])
  return (
    <div className="blurdebug">
      <b>블러 진단</b>
      {SUSPECTS.map((s) => (
        <label key={s.cls}>
          <input
            type="checkbox"
            checked={on.has(s.cls)}
            onChange={(e) =>
              setOn((p) => {
                const n = new Set(p)
                if (e.target.checked) n.add(s.cls)
                else n.delete(s.cls)
                return n
              })
            }
          />
          {s.label}
        </label>
      ))}
      <small>체크할 때마다 겹친 창 뒤가 번지는지 보세요</small>
    </div>
  )
}
