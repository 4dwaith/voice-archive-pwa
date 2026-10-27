import { useLayoutEffect, useRef, useState } from 'react'
import { useReaderContext } from '../../../contexts/ReaderContext'
import type { ReaderSegment } from '../../../models/reader'
import { ReaderSegmentContent } from '../ReaderSegmentContent/ReaderSegmentContent'
import styles from './ReaderPage.module.css'

export function ReaderPage({
  segments,
  label,
}: {
  segments: ReaderSegment[]
  label: string
}) {
  const {
    currentPage,
    pageCount,
    textSizePercent,
    setCurrentPage,
    reportPageCount,
  } = useReaderContext()
  const columnsRef = useRef<HTMLDivElement>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const columns = columnsRef.current!
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      )
    })
    observer.observe(columns)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    reportPageCount(null)
    const columns = columnsRef.current!
    const document = columns.ownerDocument
    const window = document.defaultView!
    let isCancelled = false
    let frame = 0

    const measurePageCount = async () => {
      if (segments.length === 0) {
        reportPageCount(0)
        return
      }
      if (width <= 0 || height <= 0) return

      const font = window.getComputedStyle(columns)
      // A failed webfont uses CSS fallback; wait for all used fonts before measuring.
      await document.fonts
        .load(`${font.fontSize} ${font.fontFamily}`)
        .catch(() => [])
      await document.fonts.ready
      if (isCancelled) return

      frame = window.requestAnimationFrame(() => {
        if (isCancelled) return

        const gap = parseFloat(window.getComputedStyle(columns).columnGap)
        // CSS widths can be fractional; scrollWidth is integer-rounded.
        reportPageCount(
          Math.max(1, Math.round((columns.scrollWidth + gap) / (width + gap))),
        )
      })
    }

    void measurePageCount()
    document.fonts.addEventListener('loadingdone', measurePageCount)
    return () => {
      isCancelled = true
      window.cancelAnimationFrame(frame)
      document.fonts.removeEventListener('loadingdone', measurePageCount)
      reportPageCount(null)
    }
  }, [segments, width, height, textSizePercent, reportPageCount])

  useLayoutEffect(() => {
    if (pageCount === null) return

    const page = Math.max(1, Math.min(currentPage, pageCount))
    if (page !== currentPage) setCurrentPage(page)
  }, [currentPage, pageCount, setCurrentPage])

  return (
    <article
      className={styles.page}
      aria-label={label}
      aria-busy={pageCount === null}
      tabIndex={0}
      data-reader-page={currentPage}
      data-reader-page-count={pageCount ?? undefined}
      data-reader-layout-ready={pageCount !== null}
      style={{ fontSize: (16 * textSizePercent) / 100 }}
      onFocusCapture={(event) => {
        if (event.target === event.currentTarget) return

        const viewport = windowRef.current!.getBoundingClientRect()
        const fragments = Array.from(
          (event.target as HTMLElement).getClientRects(),
        )
        if (
          fragments.some(
            (rect) => rect.right > viewport.left && rect.left < viewport.right,
          )
        )
          return

        const first = fragments[0]
        const gap = parseFloat(getComputedStyle(columnsRef.current!).columnGap)
        if (first)
          setCurrentPage(
            Math.max(
              1,
              currentPage +
                Math.round(
                  (first.left - viewport.left) / (viewport.width + gap),
                ),
            ),
          )
      }}
    >
      <div ref={windowRef} className={styles.window} data-reader-page-window>
        <div
          ref={columnsRef}
          className={styles.columns}
          data-reader-page-columns
          style={{
            transform: `translateX(calc(${1 - currentPage} * (100% + var(--reader-column-gap))))`,
          }}
        >
          {segments.map((segment) => (
            <ReaderSegmentContent key={segment.id} segment={segment} />
          ))}
        </div>
      </div>
    </article>
  )
}
