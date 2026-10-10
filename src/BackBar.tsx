import { ChevronLeft, X } from 'lucide-react'
import type { Go } from './MatTable'

/**
 * Closes the detail panel and returns to the list.
 * Wide screens: ✕ in the panel corner. Mobile: "← 목록" bar (CSS shows only one of them).
 */
export default function BackBar({ page, go }: { page: 'items' | 'pals' | 'structs'; go: Go }) {
  return (
    <>
      <button className="backbar" onClick={() => go(page)}>
        <ChevronLeft size={18} />목록
      </button>
      <button className="close" title="닫기" onClick={() => go(page)}>
        <X size={18} />
      </button>
    </>
  )
}
