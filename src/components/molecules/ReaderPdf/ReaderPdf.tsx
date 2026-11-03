import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { useReaderContext } from '../../../contexts/ReaderContext'
import { ReaderModeSwitch } from '../ReaderControls/ReaderModeSwitch'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

// Workers resolve relative URLs against their own script, so resolve assets
// against the application document first (including Storybook's relative base).
const assetUrl = new URL(`${import.meta.env.BASE_URL}pdfjs/`, document.baseURI)
  .href
const options = {
  disableRange: false,
  disableStream: true,
  disableAutoFetch: true,
  cMapUrl: `${assetUrl}cmaps/`,
  standardFontDataUrl: `${assetUrl}standard_fonts/`,
  wasmUrl: `${assetUrl}wasm/`,
  iccUrl: `${assetUrl}iccs/`,
}
const controlClass =
  'min-h-[48px] border-2 border-ink bg-page px-[12px] font-bold focus-visible:outline-4 focus-visible:outline-accent disabled:opacity-50'

export default function ReaderPdf() {
  const { pdf, selectedSegmentId } = useReaderContext().reader
  const regions = pdf?.regions ?? []
  const viewport = useRef<HTMLDivElement>(null)
  const canCenter = useRef(true)
  const [width, setWidth] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [labels, setLabels] = useState<string[] | null>(null)
  const [visiblePage, setVisiblePage] = useState(1)
  const [manualPage, setManualPage] = useState<{
    selectionId: number | null
    page: number
  } | null>(null)
  const [retry, setRetry] = useState(0)
  if (manualPage && manualPage.selectionId !== selectedSegmentId)
    setManualPage(null)
  const pages =
    manualPage?.selectionId === selectedSegmentId
      ? [manualPage.page]
      : [...new Set(regions.map((region) => region.page_index + 1))].sort(
          (a, b) => a - b,
        )
  const pageWidth = Math.max(100, width - 32) * zoom

  const centerRegions = useCallback(() => {
    const container = viewport.current
    if (!container || !canCenter.current) return
    if (
      container.querySelectorAll('canvas').length !==
      container.querySelectorAll('[data-pdf-page]').length
    )
      return
    const boxes = [
      ...container.querySelectorAll<HTMLElement>('[data-pdf-region]'),
    ].map((element) => element.getBoundingClientRect())
    if (!boxes.length || boxes.some((box) => !box.height)) return
    const frame = container.getBoundingClientRect()
    const top = Math.min(...boxes.map((box) => box.top))
    const bottom = Math.max(...boxes.map((box) => box.bottom))
    const left = Math.min(...boxes.map((box) => box.left))
    const right = Math.max(...boxes.map((box) => box.right))
    container.scrollTo({
      top:
        container.scrollTop +
        (top + bottom) / 2 -
        frame.top -
        container.clientHeight / 2,
      left:
        container.scrollLeft +
        (left + right) / 2 -
        frame.left -
        container.clientWidth / 2,
      behavior: 'instant',
    })
    const nearest = [
      ...container.querySelectorAll<HTMLElement>('[data-pdf-page]'),
    ].sort(
      (a, b) =>
        Math.abs(a.getBoundingClientRect().top - frame.top) -
        Math.abs(b.getBoundingClientRect().top - frame.top),
    )[0]
    if (nearest) setVisiblePage(Number(nearest.dataset.pdfPage))
  }, [])

  useLayoutEffect(() => {
    const container = viewport.current!
    const observer = new ResizeObserver(() => setWidth(container.clientWidth))
    setWidth(container.clientWidth)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    canCenter.current = true
  }, [selectedSegmentId])

  useLayoutEffect(centerRegions, [regions, width, zoom, centerRegions])

  function browsePage(page: number) {
    if (!Number.isInteger(page) || page < 1 || page > pageCount) return
    canCenter.current = false
    setManualPage({ selectionId: selectedSegmentId, page })
    setVisiblePage(page)
    viewport.current?.scrollTo({ top: 0, left: 0 })
  }

  const failure = (
    <div role="alert" className="p-4">
      <p>The PDF could not be displayed. You can keep reading the text.</p>
      <button
        className={controlClass}
        onClick={() => {
          setLabels(null)
          setPageCount(0)
          setRetry((value) => value + 1)
        }}
      >
        Retry PDF
      </button>
    </div>
  )

  return (
    <section
      aria-label="Source PDF"
      className="flex h-full min-w-0 flex-col bg-page text-[16px] text-ink"
    >
      <header className="flex max-h-[40%] shrink-0 flex-wrap items-center gap-[8px] overflow-auto border-b-2 border-ink p-[8px]">
        <ReaderModeSwitch />
        <button
          className={controlClass}
          disabled={!pageCount || visiblePage <= 1}
          onClick={() => browsePage(visiblePage - 1)}
        >
          Previous PDF page
        </button>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            browsePage(Number(new FormData(event.currentTarget).get('page')))
          }}
        >
          <label>
            Physical page{' '}
            <input
              key={visiblePage}
              className={`${controlClass} w-[96px]`}
              name="page"
              type="number"
              min={1}
              max={pageCount || undefined}
              defaultValue={visiblePage}
            />
          </label>
          <button className={controlClass} disabled={!pageCount}>
            Go
          </button>
        </form>
        <span>
          of {pageCount || '…'}
          {labels?.[visiblePage - 1]
            ? ` · Printed label: ${labels[visiblePage - 1]}`
            : ''}
        </span>
        <button
          className={controlClass}
          disabled={!pageCount || visiblePage >= pageCount}
          onClick={() => browsePage(visiblePage + 1)}
        >
          Next PDF page
        </button>
        <label>
          PDF zoom{' '}
          <select
            className={controlClass}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          >
            {[0.5, 1, 1.5, 2, 3].map((value) => (
              <option key={value} value={value}>
                {value * 100}%
              </option>
            ))}
          </select>
        </label>
      </header>
      <div
        ref={viewport}
        tabIndex={0}
        aria-label="PDF pages"
        className="min-h-0 flex-1 overflow-auto overscroll-contain [scrollbar-gutter:stable] focus-visible:outline-4 focus-visible:outline-accent"
        onWheel={() => {
          canCenter.current = false
        }}
        onPointerDown={() => {
          canCenter.current = false
        }}
        onTouchStart={() => {
          canCenter.current = false
        }}
        onKeyDown={(event) => {
          if (
            [
              'PageDown',
              'PageUp',
              'ArrowDown',
              'ArrowUp',
              'ArrowLeft',
              'ArrowRight',
              'Home',
              'End',
            ].includes(event.key)
          )
            canCenter.current = false
        }}
        onScroll={() => {
          const container = viewport.current!
          const top = container.getBoundingClientRect().top
          const closest = [
            ...container.querySelectorAll<HTMLElement>('[data-pdf-page]'),
          ].sort(
            (a, b) =>
              Math.abs(a.getBoundingClientRect().top - top) -
              Math.abs(b.getBoundingClientRect().top - top),
          )[0]
          if (closest) setVisiblePage(Number(closest.dataset.pdfPage))
        }}
      >
        {!pdf?.url ? (
          <p role="status" className="p-4">
            No source PDF is available for this book.
          </p>
        ) : (
          <Document
            key={retry}
            file={pdf.url}
            options={options}
            suspense={false}
            loading={<p role="status">Loading PDF…</p>}
            error={failure}
            onLoadSuccess={(document) => {
              setPageCount(document.numPages)
              void document
                .getPageLabels()
                .then(setLabels)
                .catch(() => {})
            }}
          >
            {!pages.length && (
              <p role="status" className="p-4">
                {selectedSegmentId === null
                  ? 'Select text or browse a PDF page.'
                  : 'This text has no PDF regions.'}
              </p>
            )}
            <div className="flex w-max min-w-full flex-col items-center gap-[16px] p-[16px]">
              {width > 0 &&
                pages.map((page) => (
                  <div
                    key={page}
                    data-pdf-page={page}
                    className="relative w-fit shrink-0 outline outline-ink"
                  >
                    <Page
                      pageNumber={page}
                      width={pageWidth}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      error={failure}
                      onRenderSuccess={centerRegions}
                    />
                    {regions
                      .filter((region) => region.page_index + 1 === page)
                      .map((region, index) => (
                        <div
                          key={index}
                          data-pdf-region
                          aria-hidden="true"
                          className="pointer-events-none absolute border-4 border-ink bg-yellow-300/30"
                          style={{
                            left: `${region.x0 * 100}%`,
                            top: `${region.y0 * 100}%`,
                            width: `${(region.x1 - region.x0) * 100}%`,
                            height: `${(region.y1 - region.y0) * 100}%`,
                          }}
                        />
                      ))}
                  </div>
                ))}
            </div>
          </Document>
        )}
      </div>
    </section>
  )
}
