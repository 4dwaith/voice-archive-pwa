import {
  Fragment,
  useId,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import { useReaderContext } from '../../../contexts/ReaderContext'
import { ReaderAudioButton } from '../../molecules/ReaderControls/ReaderAudioButton'
import { NavigationArrows } from './NavigationArrows'
import {
  resolvePageNumber,
  resolvePageNumberFromFraction,
} from './resolvePageNumber'

export function ReaderProgressNavigation({ message }: { message?: string }) {
  const audio = useReaderContext().reader.audio
  const isAudio = audio?.isPlaying ?? false
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
    'min-h-[48px] cursor-pointer border-2 border-black bg-white text-black focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-default disabled:border-dashed disabled:text-neutral-600'
  const positionText =
    total === 0 ? 'No pages' : `Page ${page ?? '?'} of ${total ?? '?'}`

  function requestNavigation(
    requestedPage: number,
    kind: 'absolute' | 'relative',
  ) {
    if (!canNavigate) return
    const target = resolvePageNumber(requestedPage, available)
    if (target === null) return

    audio?.pausePlayback({ restartFromPage: true })
    requestPageNavigation(
      kind === 'absolute'
        ? { scope: pageScope, kind, pageNumber: target }
        : { scope: pageScope, kind, delta: target - page! },
    )
  }

  function recordTrackPointerStart(event: PointerEvent<HTMLDivElement>) {
    pointerStart.current = {
      x: event.clientX,
      y: event.clientY,
      hasDragged: false,
    }
  }

  function markTrackPointerDrag(event: PointerEvent<HTMLDivElement>) {
    const start = pointerStart.current
    // Allow small pointer jitter, but do not turn a drag into a page jump.
    if (
      start &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8
    )
      start.hasDragged = true
  }

  function cancelTrackPointer() {
    if (pointerStart.current) pointerStart.current.hasDragged = true
  }

  function navigateToTrackPosition(event: MouseEvent<HTMLDivElement>) {
    const start = pointerStart.current
    pointerStart.current = null
    if (!canNavigate || start?.hasDragged) return
    const rect = event.currentTarget.getBoundingClientRect()
    const width = event.currentTarget.clientWidth
    if (width === 0) return
    // Measure within the track's inner width, excluding its left border.
    const target = resolvePageNumberFromFraction(
      (event.clientX - rect.left - event.currentTarget.clientLeft) / width,
      available!,
    )
    if (target !== null) requestNavigation(target, 'absolute')
  }

  function navigateWithTrackKey(event: KeyboardEvent<HTMLDivElement>) {
    // Track keys step through pages; Home and End select absolute destinations.
    const delta = {
      ArrowLeft: -1,
      ArrowDown: -1,
      ArrowRight: 1,
      ArrowUp: 1,
      PageUp: -5,
      PageDown: 5,
    }[event.key]
    if (delta === undefined && event.key !== 'Home' && event.key !== 'End')
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
  }

  return (
    <nav
      aria-label="Page navigation"
      className="@container mx-auto w-full space-y-6 border-t-2 border-black bg-white p-[10px] text-black"
    >
      <div className="flex flex-wrap items-center justify-between gap-[12px]">
        <div role="group" aria-label="Page view" className="flex">
          {(['local', 'global'] as const).map((scope) => (
            <button
              key={scope}
              type="button"
              aria-pressed={pageScope === scope}
              className={`${buttonClass} min-w-[88px] px-[12px] py-[4px] aria-pressed:bg-black aria-pressed:text-white`}
              onClick={() => setPageScope(scope)}
            >
              <span className="text-lg leading-none font-bold">
                {scope === 'local' ? 'Chapter' : 'Book'}
              </span>
            </button>
          ))}
        </div>
        <p
          className="text-2xl leading-none font-bold tabular-nums"
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
        className={`relative h-[44px] w-full cursor-pointer overflow-hidden border-2 border-black focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-black ${total === null ? 'border-r-dashed' : ''}`}
        style={{
          backgroundImage: hasPages
            ? 'linear-gradient(to right, transparent calc(100% - min(2px, 20%)), black calc(100% - min(2px, 20%)))'
            : 'repeating-linear-gradient(135deg, white 0 10px, #777 10px 12px)',
          backgroundSize: hasPages
            ? `calc(100% / ${available}) 100%`
            : undefined,
        }}
        onPointerDown={recordTrackPointerStart}
        onPointerMove={markTrackPointerDrag}
        onPointerCancel={cancelTrackPointer}
        onClick={navigateToTrackPosition}
        onKeyDown={navigateWithTrackKey}
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
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        {[-1, 1].map((direction) => (
          <Fragment key={direction}>
            {direction > 0 && (
              <div className="min-w-0 self-center text-center wrap-anywhere">
                <p id={helpId} className="text-base">
                  {isAudio
                    ? 'Audio skips use seconds.'
                    : isBook && total === null
                      ? `${indexedPageCount} pages indexed. Book total unknown.`
                      : total === null
                        ? 'Chapter pages have not been counted yet.'
                        : total === 0
                          ? `No ${isBook ? 'book' : 'chapter'} pages available.`
                          : page === null
                            ? 'Book position unknown. Use Chapter view to navigate.'
                            : 'Tap a page segment to jump.'}
                </p>
                <p role="status">
                  {audio?.error ??
                    (audio?.status === 'preparing'
                      ? 'Preparing narration…'
                      : audio?.status === 'buffering'
                        ? 'Buffering narration…'
                        : audio?.status === 'ended'
                          ? 'No more narrated segments.'
                          : (message ??
                            (isPageNavigationPending ? 'Changing page…' : '')))}
                </p>
                <ReaderAudioButton />
              </div>
            )}
            <div
              role="group"
              aria-label={
                isAudio
                  ? direction < 0
                    ? 'Rewind audio'
                    : 'Advance audio'
                  : direction < 0
                    ? 'Previous pages'
                    : 'Next pages'
              }
              className={`flex flex-col gap-4 ${isAudio ? '@min-[60em]:flex-row' : '@min-[40em]:flex-row'}`}
            >
              {(direction < 0
                ? isAudio
                  ? [30, 15, 5]
                  : [25, 5, 1]
                : isAudio
                  ? [5, 15, 30]
                  : [1, 5, 25]
              ).map((step) => {
                const noOfArrows =
                  step === (isAudio ? 5 : 1)
                    ? 1
                    : step === (isAudio ? 15 : 5)
                      ? 2
                      : 3

                return (
                  <button
                    key={step}
                    type="button"
                    className={`${buttonClass} flex min-w-11 items-center justify-center gap-1 px-4.5 py-2`}
                    aria-label={`${direction < 0 ? 'Back' : 'Forward'} ${step} ${isAudio ? 'seconds' : step === 1 ? 'page' : 'pages'}`}
                    disabled={
                      isAudio
                        ? audio?.status === 'preparing'
                        : !canNavigate ||
                          (direction < 0 ? page! <= 1 : page! >= available!)
                    }
                    onClick={() =>
                      isAudio
                        ? audio?.seekBySeconds(direction * step)
                        : requestNavigation(
                            page! + direction * step,
                            'relative',
                          )
                    }
                  >
                    <NavigationArrows
                      direction={direction}
                      noOfArrows={noOfArrows}
                    />
                    <span className="text-lg leading-none font-bold">
                      {step}
                      {isAudio ? 's' : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          </Fragment>
        ))}
      </div>
    </nav>
  )
}
