import { useCallback, useLayoutEffect, useRef, useState, type Ref } from 'react'
import type {
  ReaderLayoutMeasurement,
  ReaderSegment,
} from '../../../models/reader'
import { ReaderSegmentContent } from '../ReaderSegmentContent/ReaderSegmentContent'
import { measurePageBoundaries } from './measurePageBoundaries'

export function ReaderChapterLayout({
  segments,
  page,
  textSizePercent,
  shouldCount = false,
  shouldMeasure = false,
  onPageCount,
  onPageMeasure,
  viewportRef,
}: {
  segments: ReaderSegment[]
  page: number
  textSizePercent: number
  shouldCount?: boolean
  shouldMeasure?: boolean
  onPageCount?: (count: number | null) => void
  onPageMeasure?: (measurement: ReaderLayoutMeasurement) => void
  viewportRef?: Ref<HTMLDivElement>
}) {
  const columnsRef = useRef<HTMLDivElement>(null)
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 })
  const reportMeasurement = useCallback(
    (columns: HTMLElement, count: number, gap: number) => {
      if (shouldCount) onPageCount?.(count)
      if (shouldMeasure)
        onPageMeasure?.({
          width,
          height,
          textSizePercent,
          ...measurePageBoundaries(columns, segments, count, width, gap),
        })
    },
    [
      shouldCount,
      shouldMeasure,
      onPageCount,
      onPageMeasure,
      width,
      height,
      textSizePercent,
      segments,
    ],
  )

  useLayoutEffect(function observeReaderViewportSize() {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      )
    })
    observer.observe(columnsRef.current!)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(
    function measureReaderPageLayout() {
      if (!shouldCount && !shouldMeasure) return

      if (shouldCount) onPageCount?.(null)

      const columns = columnsRef.current!
      const document = columns.ownerDocument
      const window = document.defaultView!
      let isCancelled = false
      let frame = 0
      // Font loading can overlap; only the latest readiness pass may publish.
      let latestRequest = 0

      const measurePageLayout = async () => {
        if (width <= 0 || height <= 0) return
        if (segments.length === 0) {
          reportMeasurement(columns, 0, 0)
          return
        }

        const request = ++latestRequest
        const font = window.getComputedStyle(columns)

        // A failed webfont uses CSS fallback; wait for used fonts before measuring.
        await document.fonts
          .load(`${font.fontSize} ${font.fontFamily}`)
          .catch(() => [])
        await document.fonts.ready

        if (isCancelled || request !== latestRequest) return

        window.cancelAnimationFrame(frame)
        frame = window.requestAnimationFrame(() => {
          if (isCancelled || request !== latestRequest) return
          const gap = parseFloat(window.getComputedStyle(columns).columnGap)
          // CSS widths can be fractional; scrollWidth is integer-rounded.
          const count = Math.max(
            1,
            Math.round((columns.scrollWidth + gap) / (width + gap)),
          )
          reportMeasurement(columns, count, gap)
        })
      }

      // Measure the page layout immediately - it will wait for the current fonts to finish loading.
      void measurePageLayout()

      // If more fonts are loaded in the future, measure the page layout again.
      document.fonts.addEventListener('loadingdone', measurePageLayout)

      return () => {
        isCancelled = true
        window.cancelAnimationFrame(frame)
        document.fonts.removeEventListener('loadingdone', measurePageLayout)
        if (shouldCount) onPageCount?.(null)
      }
    },
    [
      segments,
      width,
      height,
      shouldCount,
      shouldMeasure,
      onPageCount,
      reportMeasurement,
    ],
  )

  return (
    <div
      className="box-border h-full min-h-0 w-full min-w-0 overflow-clip bg-page p-5 leading-[1.65] text-ink [--reader-column-gap:32px]"
      dir="ltr"
      style={{ fontSize: (16 * textSizePercent) / 100 }}
    >
      <div
        ref={viewportRef}
        className="h-full w-full overflow-clip"
        data-reader-page-window
      >
        <div
          ref={columnsRef}
          className="h-full w-full columns-1 [column-fill:auto] gap-x-(--reader-column-gap) [orphans:1] [widows:1] [writing-mode:horizontal-tb]"
          data-reader-page-columns
          style={{
            transform: `translateX(calc(${1 - page} * (100% + var(--reader-column-gap))))`,
          }}
        >
          {segments.map((segment) => (
            <ReaderSegmentContent key={segment.id} segment={segment} />
          ))}
        </div>
      </div>
    </div>
  )
}
