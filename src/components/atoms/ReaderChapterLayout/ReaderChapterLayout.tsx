import {
  useCallback,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
} from 'react'
import type {
  ReaderLayoutMeasurement,
  ReaderSegment,
} from '../../../models/reader'
import { ReaderSegmentContent } from '../ReaderSegmentContent/ReaderSegmentContent'
import { measurePageBoundaries } from './measurePageBoundaries'
import { useObserveTypographyChanges } from '../../../hooks/useObserveTypographyChanges'
import {
  createLayoutKey,
  readFontEnvironment,
  readTypography,
  READER_LAYOUT_VERSION,
} from './layoutKey'

export function ReaderChapterLayout({
  segments,
  page,
  textSizePercent,
  shouldMeasure = false,
  onPageMeasure,
  viewportRef,
  onLayoutKeyChange,
}: {
  segments: ReaderSegment[]
  page: number
  textSizePercent: number
  shouldMeasure?: boolean
  onPageMeasure?: (measurement: ReaderLayoutMeasurement) => void
  viewportRef?: Ref<HTMLDivElement>
  onLayoutKeyChange?: (key: string | null) => void
}) {
  const previousLayoutInputs = useRef<string | undefined>(undefined)
  const publishedKey = useRef<string | null | undefined>(undefined)
  const shouldObserveLayoutKey = onLayoutKeyChange !== undefined

  // Ensures that when this function is called in an effect,
  // it refers to the latest values from the render function
  const publishLayoutKey = useEffectEvent((key: string | null) => {
    if (publishedKey.current === key) return
    publishedKey.current = key
    onLayoutKeyChange?.(key)
  })

  const latestRequest = useRef(0)

  const invalidateFontLayout = () => {
    ++latestRequest.current
    if (publishedKey.current !== null) {
      publishedKey.current = null
      onLayoutKeyChange?.(null)
    }
  }

  const columnsRef = useRef<HTMLDivElement>(null)

  const typographyRevision = useObserveTypographyChanges(
    columnsRef,
    shouldMeasure || shouldObserveLayoutKey,
    invalidateFontLayout,
  )

  const [{ width, height }, setSize] = useState({ width: 0, height: 0 })
  const reportMeasurement = useCallback(
    (columns: HTMLElement, count: number, gap: number, layoutKey: string) => {
      if (shouldMeasure)
        onPageMeasure?.({
          layoutKey,
          width,
          height,
          textSizePercent,
          ...measurePageBoundaries(columns, segments, count, width, gap),
        })
    },
    [shouldMeasure, onPageMeasure, width, height, textSizePercent, segments],
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
      if (!shouldMeasure && !shouldObserveLayoutKey) return

      // Content and callback updates can rerun this effect without changing
      // the content-independent key. Only changed rendering inputs unset it.
      const layoutInputs = JSON.stringify([
        width,
        height,
        textSizePercent,
        typographyRevision,
      ])
      if (previousLayoutInputs.current !== layoutInputs) publishLayoutKey(null)
      previousLayoutInputs.current = layoutInputs

      const columns = columnsRef.current!
      const document = columns.ownerDocument
      const window = document.defaultView!
      let isCancelled = false
      let frame = 0

      const measurePageLayout = async () => {
        if (width <= 0 || height <= 0) return

        const request = ++latestRequest.current
        const fontEnvironment = await readFontEnvironment(columns)

        const layoutKey = await createLayoutKey({
          rendererVersion: READER_LAYOUT_VERSION,
          width,
          height,
          textSizePercent,
          typography: readTypography(window.getComputedStyle(columns)),
          fontEnvironment,
        })

        if (isCancelled || request !== latestRequest.current) return

        window.cancelAnimationFrame(frame)
        frame = window.requestAnimationFrame(() => {
          if (isCancelled || request !== latestRequest.current) return
          if (document.fonts.status === 'loading' || layoutKey === null) return

          publishLayoutKey(layoutKey)
          const gap = parseFloat(window.getComputedStyle(columns).columnGap)
          // CSS widths can be fractional; scrollWidth is integer-rounded.
          const count =
            segments.length === 0
              ? 0
              : Math.max(
                  1,
                  Math.round((columns.scrollWidth + gap) / (width + gap)),
                )
          reportMeasurement(columns, count, gap, layoutKey)
        })
      }

      void measurePageLayout()

      return () => {
        isCancelled = true
        window.cancelAnimationFrame(frame)
      }
    },
    [
      segments,
      width,
      height,
      shouldMeasure,
      reportMeasurement,
      textSizePercent,
      shouldObserveLayoutKey,
      typographyRevision,
    ],
  )

  return (
    <div
      className="box-border h-full min-h-0 w-full min-w-0 overflow-clip bg-page p-5 leading-[1.65] text-ink [--reader-column-gap:32px]"
      dir="ltr"
      style={{ fontSize: (24 * textSizePercent) / 100 }}
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
