import { useId, useRef } from 'react'
import { useReaderContext } from '../../../contexts/ReaderContext'
import {
  resolvePageNumber,
  resolvePageNumberFromFraction,
} from './resolvePageNumber'

function NavigationArrows({
  direction,
  noOfArrows,
}: {
  direction: number
  noOfArrows: number
}) {
  return (
    <svg
      aria-hidden="true"
      width="36"
      height="24"
      viewBox="0 0 36 24"
      fill="currentColor"
    >
      <g transform={direction < 0 ? 'rotate(180 18 12)' : undefined}>
        {Array.from({ length: noOfArrows }, (_, index) => (
          <path
            key={index}
            d="M0 3 L10 12 L0 21Z"
            transform={`translate(${(36 - noOfArrows * 12) / 2 + index * 12} 0)`}
          />
        ))}
      </g>
    </svg>
  )
}

export function ReaderProgressNavigation() {
  const {
    pageScope,
    setPageScope,
    currentPage,
    pageCount,
    globalPage,
    totalPageCount,
    indexedPageCount,
    isPageNavigationPending,
    requestPageNavigation,
  } = useReaderContext().navigation

  const helpId = useId()
  const pointerStart = useRef<{
    x: number
    y: number
    hasDragged: boolean
  } | null>(null)

  const isBook = pageScope === 'global'
  const page = isBook ? globalPage : currentPage
  const total = isBook ? totalPageCount : pageCount
  const available = isBook ? indexedPageCount : pageCount
  const hasPages = available !== null && available > 0
  const hasPosition = hasPages && page !== null
  const canNavigate = hasPosition && !isPageNavigationPending
  const label = isBook ? 'Book' : 'Chapter'
  const buttonClass =
    'min-h-14 cursor-pointer border-2 border-black bg-white text-black focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-default disabled:border-dashed disabled:text-neutral-600'
  const positionText =
    total === 0 ? 'No pages' : `Page ${page ?? '?'} of ${total ?? '?'}`

  function requestNavigation(
    requestedPage: number,
    kind: 'absolute' | 'relative',
  ) {
    if (!canNavigate) return
    const target = resolvePageNumber(requestedPage, available)
    if (target === null || target === page) return

    requestPageNavigation(
      kind === 'absolute'
        ? { scope: pageScope, kind, pageNumber: target }
        : { scope: pageScope, kind, delta: target - page! },
    )
  }

  return (
    <nav
      aria-label="Page navigation"
      className="@container mx-auto w-full max-w-150 space-y-4 border-t-2 border-black bg-white p-3 text-black"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Page view" className="flex">
          {(['local', 'global'] as const).map((scope) => (
            <button
              key={scope}
              type="button"
              aria-pressed={pageScope === scope}
              className={`${buttonClass} min-w-24 px-3 aria-pressed:bg-black aria-pressed:text-white`}
              onClick={() => setPageScope(scope)}
            >
              <span className="text-lg font-bold">
                {scope === 'local' ? 'Chapter' : 'Book'}
              </span>
            </button>
          ))}
        </div>
        <p
          className="text-2xl font-bold tabular-nums"
          aria-label={`${label}: ${positionText}`}
        >
          {positionText}
        </p>
      </div>
      <div
        role={hasPosition ? 'slider' : 'group'}
        aria-label={`${label} page`}
        aria-valuemin={hasPosition ? 1 : undefined}
        aria-valuemax={hasPosition ? available! : undefined}
        aria-valuenow={hasPosition ? page! : undefined}
        aria-valuetext={
          hasPosition
            ? `${positionText}${isBook && total === null ? `; ${available} pages indexed, total unknown` : ''}`
            : undefined
        }
        aria-disabled={!canNavigate}
        aria-describedby={helpId}
        tabIndex={canNavigate ? 0 : -1}
        className={`relative h-14 w-full cursor-pointer overflow-hidden border-2 border-black focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-black ${total === null ? 'border-r-dashed' : ''}`}
        style={{
          backgroundImage: hasPages
            ? 'linear-gradient(to right, transparent calc(100% - min(2px, 20%)), black calc(100% - min(2px, 20%)))'
            : 'repeating-linear-gradient(135deg, white 0 10px, #777 10px 12px)',
          backgroundSize: hasPages
            ? `calc(100% / ${available}) 100%`
            : undefined,
        }}
        onPointerDown={(event) => {
          pointerStart.current = {
            x: event.clientX,
            y: event.clientY,
            hasDragged: false,
          }
        }}
        onPointerMove={(event) => {
          const start = pointerStart.current
          if (
            start &&
            Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8
          )
            start.hasDragged = true
        }}
        onPointerCancel={() => {
          if (pointerStart.current) pointerStart.current.hasDragged = true
        }}
        onClick={(event) => {
          const start = pointerStart.current
          pointerStart.current = null
          if (!canNavigate || start?.hasDragged) return
          const rect = event.currentTarget.getBoundingClientRect()
          const width = event.currentTarget.clientWidth
          if (width === 0) return
          const target = resolvePageNumberFromFraction(
            (event.clientX - rect.left - event.currentTarget.clientLeft) /
              width,
            available!,
          )
          if (target !== null) requestNavigation(target, 'absolute')
        }}
        onKeyDown={(event) => {
          const delta = {
            ArrowLeft: -1,
            ArrowDown: -1,
            ArrowRight: 1,
            ArrowUp: 1,
            PageUp: -5,
            PageDown: 5,
          }[event.key]
          if (
            delta === undefined &&
            event.key !== 'Home' &&
            event.key !== 'End'
          )
            return
          event.preventDefault()
          requestNavigation(
            delta !== undefined
              ? (page ?? 1) + delta
              : event.key === 'Home'
                ? 1
                : (available ?? 1),
            delta !== undefined ? 'relative' : 'absolute',
          )
        }}
      >
        {hasPosition && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 bg-black"
            style={{
              left: `${((page! - 1) / available!) * 100}%`,
              width: `${100 / available!}%`,
            }}
          />
        )}
      </div>
      <div className="flex flex-wrap justify-between gap-3">
        {[-1, 1].map((direction) => (
          <div
            key={direction}
            role="group"
            aria-label={direction < 0 ? 'Previous pages' : 'Next pages'}
            className={`flex gap-1 ${direction > 0 ? 'ms-auto' : ''}`}
          >
            {(direction < 0 ? [25, 5, 1] : [1, 5, 25]).map((step) => {
              const noOfArrows = step === 1 ? 1 : step === 5 ? 2 : 3

              return (
                <button
                  key={step}
                  type="button"
                  className={`${buttonClass} flex min-h-18 w-11 flex-col items-center justify-center @min-[480px]:w-16`}
                  aria-label={`${direction < 0 ? 'Back' : 'Forward'} ${step} ${step === 1 ? 'page' : 'pages'}`}
                  disabled={
                    !canNavigate ||
                    (direction < 0 ? page! <= 1 : page! >= available!)
                  }
                  onClick={() =>
                    requestNavigation(page! + direction * step, 'relative')
                  }
                >
                  <NavigationArrows
                    direction={direction}
                    noOfArrows={noOfArrows}
                  />
                  <span className="text-lg font-bold">{step}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <p id={helpId} className="text-base">
        {isBook && total === null
          ? `${indexedPageCount} pages indexed. Book total unknown.`
          : total === null
            ? 'Chapter pages have not been counted yet.'
            : total === 0
              ? `No ${isBook ? 'book' : 'chapter'} pages available.`
              : page === null
                ? 'Book position unknown. Use Chapter view to navigate.'
                : 'Tap a page segment to jump.'}
      </p>
      <p role="status">{isPageNavigationPending ? 'Changing page…' : ''}</p>
    </nav>
  )
}
