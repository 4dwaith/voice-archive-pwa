import {
  lazy,
  Suspense,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useReaderContext } from '../../../contexts/ReaderContext'

const ReaderPdf = lazy(() => import('../ReaderPdf/ReaderPdf'))

export function ReaderViews({ children }: { children: ReactNode }) {
  const { pdf } = useReaderContext().reader
  const container = useRef<HTMLDivElement>(null)
  const [isWide, setWide] = useState(false)
  const mode =
    pdf?.viewMode === 'both' && !isWide ? 'text' : (pdf?.viewMode ?? 'text')

  useLayoutEffect(() => {
    const observer = new ResizeObserver(() =>
      setWide(container.current!.clientWidth >= 900),
    )
    setWide(container.current!.clientWidth >= 900)
    observer.observe(container.current!)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={container} className="relative flex h-full min-w-0">
      <label className="absolute right-[8px] bottom-[80px] z-30 border-2 border-ink bg-page p-[8px] text-[16px] font-bold">
        Reading view{' '}
        <select
          aria-label="Reading view"
          className="min-h-[48px] border-2 border-ink bg-page px-[8px]"
          value={mode}
          onChange={(event) =>
            pdf?.setViewMode(event.target.value as 'text' | 'pdf' | 'both')
          }
        >
          <option value="text">Text</option>
          <option value="pdf">PDF</option>
          {isWide && <option value="both">Both</option>}
        </select>
      </label>
      {mode !== 'pdf' && (
        <div className="relative min-w-0 flex-1">{children}</div>
      )}
      {mode !== 'text' && (
        <div className="min-w-0 flex-1 border-l-2 border-ink">
          <Suspense fallback={<p role="status">Loading PDF viewer…</p>}>
            <ReaderPdf key={`${pdf?.scopeKey}:${pdf?.url}`} />
          </Suspense>
        </div>
      )}
    </div>
  )
}
