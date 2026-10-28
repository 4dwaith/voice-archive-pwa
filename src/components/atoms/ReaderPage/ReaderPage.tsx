import { useLayoutEffect, useRef } from 'react'
import { useReaderContext } from '../../../contexts/ReaderContext'
import type { ReaderSegment } from '../../../models/reader'
import { ReaderChapterLayout } from '../ReaderChapterLayout/ReaderChapterLayout'

export function ReaderPage({
  segments,
  label,
}: {
  segments: ReaderSegment[]
  label: string
}) {
  const { currentPage, pageCount, setCurrentPage } =
    useReaderContext().navigation
  const { textSizePercent, reportLayoutKey } = useReaderContext().reader
  const windowRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(
    function clampVisiblePageToPageCount() {
      if (pageCount === null) return
      const page = Math.max(1, Math.min(currentPage, pageCount))
      if (page !== currentPage) setCurrentPage(page)
    },
    [currentPage, pageCount, setCurrentPage],
  )

  return (
    <article
      className="h-full min-h-0 w-full min-w-0 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      aria-label={label}
      aria-busy={pageCount === null}
      tabIndex={0}
      data-reader-page={currentPage}
      data-reader-page-count={pageCount ?? undefined}
      data-reader-layout-ready={pageCount !== null}
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
        const gap = parseFloat(
          getComputedStyle(windowRef.current!).getPropertyValue(
            '--reader-column-gap',
          ),
        )

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
      <ReaderChapterLayout
        segments={segments}
        page={currentPage}
        textSizePercent={textSizePercent}
        onLayoutKeyChange={reportLayoutKey}
        viewportRef={windowRef}
      />
    </article>
  )
}
