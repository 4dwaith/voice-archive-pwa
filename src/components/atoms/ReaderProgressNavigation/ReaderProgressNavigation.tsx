import { useId, useState } from 'react'
import { useReaderContext } from '../../../contexts/ReaderContext'
import type { ReaderPageNavigation } from '../../../models/reader'
import { resolvePageNumber } from './resolvePageNumber'

export function ReaderProgressNavigation() {
  const {
    currentPage,
    pageCount,
    globalPage,
    totalPageCount,
    indexedPageCount,
    isPageNavigationPending,
    requestPageNavigation,
  } = useReaderContext().navigation
  const [rejection, setRejection] = useState<string | null>(null)
  const inputId = useId()
  const relativeScope = globalPage === null ? 'local' : 'global'
  const relativePage = globalPage ?? currentPage
  const relativeCount = globalPage === null ? pageCount : indexedPageCount
  const controlClass =
    'rounded border border-ink/30 px-3 py-2 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50'

  function requestNavigation(intent: ReaderPageNavigation) {
    const isGlobal = intent.scope === 'global'
    const result = resolvePageNumber(
      intent.kind === 'absolute'
        ? intent.pageNumber
        : relativePage + intent.delta,
      isGlobal ? indexedPageCount : pageCount,
      intent.kind,
    )
    setRejection(result.error)
    if (result.pageNumber === null || isPageNavigationPending) return
    if (intent.kind === 'relative' && result.pageNumber === relativePage) return

    requestPageNavigation(
      intent.kind === 'relative'
        ? { ...intent, delta: result.pageNumber - relativePage }
        : intent,
    )
  }

  return (
    <nav
      aria-label="Page navigation"
      className="space-y-2 bg-page p-3 text-ink"
    >
      <p>
        {pageCount === 0
          ? 'No pages in this section.'
          : `Section page ${currentPage}${pageCount === null ? '; count unknown' : ` of ${pageCount}`}.`}
      </p>
      <p>
        {totalPageCount === 0
          ? 'No book pages.'
          : `Book page ${globalPage ?? 'unknown'}${totalPageCount === null ? '; total unknown' : ` of ${totalPageCount}`}.`}
      </p>
      {totalPageCount === null && <p>{indexedPageCount} book pages indexed.</p>}
      <form
        noValidate
        onChange={() => setRejection(null)}
        onSubmit={(event) => {
          event.preventDefault()
          requestNavigation({
            scope: 'global',
            kind: 'absolute',
            pageNumber: Number(new FormData(event.currentTarget).get('page')),
          })
        }}
      >
        <fieldset disabled={isPageNavigationPending} className="space-y-2">
          <legend className="sr-only">Page controls</legend>
          <div
            role="group"
            aria-label={`${relativeScope === 'global' ? 'Book' : 'Section'} page steps`}
            className="flex flex-wrap gap-2"
          >
            {[-5, -1, 1, 5].map((delta) => (
              <button
                key={delta}
                type="button"
                className={controlClass}
                aria-label={`${delta < 0 ? 'Back' : 'Forward'} ${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'page' : 'pages'}`}
                disabled={
                  relativeCount === null ||
                  relativeCount === 0 ||
                  (delta < 0
                    ? relativePage <= 1
                    : relativePage >= relativeCount)
                }
                onClick={() =>
                  requestNavigation({
                    scope: relativeScope,
                    kind: 'relative',
                    delta,
                  })
                }
              >
                {delta > 0 ? '+' : '−'}
                {Math.abs(delta)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={inputId}>Book page</label>
            <input
              id={inputId}
              type="number"
              min={1}
              max={indexedPageCount || undefined}
              step={1}
              className={`${controlClass} w-24`}
              name="page"
              disabled={indexedPageCount === 0}
              aria-describedby={`${inputId}-help ${inputId}-status`}
              aria-invalid={rejection !== null}
            />
            <button
              type="submit"
              className={controlClass}
              disabled={indexedPageCount === 0}
            >
              Go
            </button>
          </div>
          <label className="block" htmlFor={`${inputId}-range`}>
            Book page slider
          </label>
          <input
            id={`${inputId}-range`}
            type="range"
            min={1}
            max={Math.max(1, indexedPageCount)}
            step={1}
            className="w-full accent-accent"
            value={globalPage ?? 1}
            disabled={indexedPageCount === 0 || globalPage === null}
            aria-describedby={`${inputId}-help`}
            onChange={(event) =>
              requestNavigation({
                scope: 'global',
                kind: 'absolute',
                pageNumber: Number(event.target.value),
              })
            }
          />
        </fieldset>
      </form>
      <p id={`${inputId}-help`} className="text-sm">
        {indexedPageCount === 0
          ? 'No indexed book pages to jump to.'
          : `Book jumps are available from 1 to ${indexedPageCount}.`}
      </p>
      <p id={`${inputId}-status`} role="status">
        {isPageNavigationPending ? 'Changing page…' : rejection}
      </p>
    </nav>
  )
}
