import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { useGesture } from '@use-gesture/react'
import { SEGMENT_DOUBLE_TAP_INTERVAL_MS } from '../../atoms/ReaderSegmentContent/ReaderSegmentContent'
import { useReaderContext } from '../../../contexts/ReaderContext'
import { readerPageTurnerBindings } from '../../../services/pageTurnerBindings'

const INTERACTIVE_TARGETS =
  'button, a, input, select, textarea, summary, [role="button"], [role="slider"], [contenteditable]:not([contenteditable="false"])'

export function ReaderControls({
  children,
  controls,
}: {
  children: ReactNode
  controls?: ReactNode
}) {
  const {
    areControlsVisible,
    setControlsVisible,
    selectedSegmentId,
    pdf,
    audio,
  } = useReaderContext().reader
  const { requestPageNavigation, globalPage, indexedPageCount, pageCount } =
    useReaderContext().navigation
  const suppressClick = useRef(false)
  const pendingToggle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPdf = pdf?.viewMode === 'pdf'
  const setViewMode = pdf?.setViewMode

  useEffect(
    function registerPendingToggleCleanup() {
      return function clearPendingToggle() {
        if (pendingToggle.current !== null) clearTimeout(pendingToggle.current)
      }
    },
    [areControlsVisible, selectedSegmentId],
  )

  const surface = useRef<HTMLDivElement>(null)
  const gestureSurface = useRef<HTMLDivElement>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const isPointerFocus = useRef(false)
  const isReturningFocus = useRef(false)
  const pointer = useRef<{
    x: number
    y: number
    canToggle: boolean
  } | null>(null)

  function isExcludedGestureTarget(target: EventTarget | null) {
    return (
      !(target instanceof Element) ||
      !!target.closest(INTERACTIVE_TARGETS) ||
      !!overlay.current?.contains(target)
    )
  }

  useGesture(
    {
      onDrag: ({
        first,
        last,
        event,
        movement: [dx, dy],
        touches,
        canceled,
        memo,
      }) => {
        const gesture: { isBlocked: boolean } = first
          ? { isBlocked: isPdf || isExcludedGestureTarget(event.target) }
          : memo
        if (!gesture) return
        if (touches > 1 || event.type === 'touchcancel' || canceled)
          gesture.isBlocked = true
        const selection = surface.current?.ownerDocument.getSelection()
        if (selection && !selection.isCollapsed) gesture.isBlocked = true
        if (Math.hypot(dx, dy) > 4 && pointer.current)
          pointer.current.canToggle = false
        if (last) {
          const major = Math.max(Math.abs(dx), Math.abs(dy))
          const minor = Math.min(Math.abs(dx), Math.abs(dy))
          if (
            !gesture.isBlocked &&
            event.type.startsWith('touch') &&
            major >= 48 &&
            major >= minor * 1.5
          ) {
            suppressClick.current = true
            pointer.current = null
            requestReaderMove(
              (Math.abs(dx) >= Math.abs(dy) ? dx : dy) < 0 ? 1 : -1,
            )
          }
        }
        return gesture
      },
      onPinch: ({
        first,
        last,
        event,
        origin,
        movement: [scale, angle],
        canceled,
        memo,
      }) => {
        const gesture: {
          origin: number[]
          isBlocked: boolean
          hasClaimed: boolean
        } = first
          ? {
              origin,
              isBlocked:
                !setViewMode ||
                !('touches' in event) ||
                Array.from(event.touches).some((touch) =>
                  isExcludedGestureTarget(touch.target),
                ),
              hasClaimed: false,
            }
          : memo
        if (!gesture) return
        pointer.current = null
        if (pendingToggle.current !== null) clearTimeout(pendingToggle.current)
        if (
          canceled ||
          event.type === 'touchcancel' ||
          (!last && 'touches' in event && event.touches.length !== 2)
        )
          gesture.isBlocked = true
        if (
          !gesture.isBlocked &&
          (Math.abs(scale - 1) > 0.15 || Math.abs(angle) > 15)
        ) {
          gesture.isBlocked = true
        }
        const dx = origin[0] - gesture.origin[0]
        const dy = origin[1] - gesture.origin[1]
        if (
          !last &&
          !gesture.isBlocked &&
          // Letting the first small move through lets Chrome claim the gesture.
          Math.abs(dx) > 0 &&
          Math.abs(dx) >= Math.abs(dy) * 1.5
        ) {
          if (event.cancelable) {
            event.preventDefault()
            gesture.hasClaimed = true
          } else {
            gesture.isBlocked = true
          }
        }
        if (
          last &&
          !gesture.isBlocked &&
          gesture.hasClaimed &&
          Math.abs(dx) >= 48 &&
          Math.abs(dx) >= Math.abs(dy) * 1.5
        ) {
          suppressClick.current = true
          setViewMode?.(isPdf ? 'text' : 'pdf')
        }
        return gesture
      },
    },
    {
      target: gestureSurface,
      eventOptions: { passive: false, capture: true },
      drag: {
        enabled: !isPdf,
        pointer: { touch: true, capture: false, keys: false },
        threshold: 0,
      },
      pinch: {
        pointer: { touch: true },
        threshold: [0, 0],
        pinchOnWheel: false,
      },
    },
  )

  const previousMode = useRef(isPdf)
  useEffect(() => {
    if (previousMode.current !== isPdf) {
      isReturningFocus.current = true
      surface.current?.focus({ preventScroll: true })
      isReturningFocus.current = false
    }
    previousMode.current = isPdf
  }, [isPdf])

  // Hiding the overlay must not leave keyboard focus inside hidden controls.
  useEffect(
    function returnFocusToReader() {
      if (
        !areControlsVisible &&
        overlay.current?.contains(document.activeElement)
      ) {
        isReturningFocus.current = true
        surface.current?.focus({ preventScroll: true })
        isReturningFocus.current = false
      }
    },
    [areControlsVisible],
  )

  function requestReaderMove(delta: number) {
    if (audio?.isPlaying) {
      audio.seekBySeconds(delta * 5)
      return
    }
    const available = globalPage === null ? pageCount : indexedPageCount
    if (available === null || available <= 0) return

    requestPageNavigation({
      scope: globalPage === null ? 'local' : 'global',
      kind: 'relative',
      delta,
    })
  }

  function recordPointerFocus() {
    isPointerFocus.current = true
  }

  function clearPointerFocus() {
    isPointerFocus.current = false
  }

  function showControlsForKeyboardFocus(
    event: React.FocusEvent<HTMLDivElement>,
  ) {
    if (!event.currentTarget.contains(event.target as Node)) return
    if ((event.target as Element).closest('[data-reader-audio-control]')) return
    if (!isPdf && !isPointerFocus.current && !isReturningFocus.current)
      setControlsVisible(true)
  }

  function handleReaderKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as Element
    // Narration's portal belongs to this reader; other modals retain their keys.
    const isNarration = !!target.closest('[data-reader-narration]')
    if (!event.currentTarget.contains(target) && !isNarration) return
    if (event.defaultPrevented) return

    const delta = ['PageDown', 'ArrowRight', 'ArrowDown'].includes(event.key)
      ? 1
      : ['PageUp', 'ArrowLeft', 'ArrowUp'].includes(event.key)
        ? -1
        : null
    const selection = event.currentTarget.ownerDocument.getSelection()
    const isMediaKey = readerPageTurnerBindings.some(
      (binding) => binding.key === event.key,
    )
    // PDF owns its native navigation keys; mode/narration bindings stay shared.
    if (isPdf && !isMediaKey) return
    if (target.closest('[data-reader-audio-control]')) return
    isPointerFocus.current = false

    // Reading keys must leave overlay controls and native text selection alone.
    if (
      (delta !== null || isMediaKey) &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      !overlay.current?.contains(event.target as Node) &&
      !target.closest(INTERACTIVE_TARGETS) &&
      (!selection || selection.isCollapsed)
    ) {
      event.preventDefault()
      if (!event.repeat) {
        if (event.key === readerPageTurnerBindings[0].key) {
          if (!isPdf && (audio?.canPlay || audio?.isPlaying))
            audio.togglePlayback()
        } else if (event.key === readerPageTurnerBindings[1].key) {
          setViewMode?.(isPdf ? 'text' : 'pdf')
        } else if (delta !== null) {
          if (!isNarration) {
            // Page changes can replace focused text; keep later keys on the reader.
            isReturningFocus.current = true
            surface.current?.focus({ preventScroll: true })
            isReturningFocus.current = false
          }
          requestReaderMove(delta)
        }
      }
      return
    }

    if (isNarration || isMediaKey) return

    if (event.key === 'Escape') {
      event.preventDefault()
      setControlsVisible(false)
    } else {
      setControlsVisible(true)
    }
  }

  function suppressClickAfterSwipe(event: MouseEvent<HTMLDivElement>) {
    if (!suppressClick.current) return
    suppressClick.current = false

    event.preventDefault()
    event.stopPropagation()
  }

  function recordGestureStart(event: PointerEvent<HTMLDivElement>) {
    suppressClick.current = false
    if (pendingToggle.current !== null) clearTimeout(pendingToggle.current)

    // Additional touch pointers abandon the gesture so pinch zoom can take over.
    if (!event.isPrimary) {
      pointer.current = null
      return
    }

    const selection = event.currentTarget.ownerDocument.getSelection()
    const canToggle =
      !isPdf &&
      event.button === 0 &&
      !(event.target as Element).closest(INTERACTIVE_TARGETS) &&
      (!selection || selection.isCollapsed)

    pointer.current = {
      x: event.clientX,
      y: event.clientY,
      canToggle,
    }
  }

  // Small pointer jitter is allowed; dragging must not toggle the overlay.
  function cancelTapAfterMovement(event: PointerEvent<HTMLDivElement>) {
    const start = pointer.current
    if (
      start &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4
    )
      start.canToggle = false
  }

  function cancelGesture() {
    pointer.current = null
  }

  function toggleControlsForTap(event: MouseEvent<HTMLDivElement>) {
    const start = pointer.current
    pointer.current = null
    const selection = event.currentTarget.ownerDocument.getSelection()

    if (
      start?.canToggle &&
      event.button === 0 &&
      !(event.target as Element).closest(INTERACTIVE_TARGETS) &&
      (!selection || selection.isCollapsed)
    ) {
      if (pendingToggle.current !== null) clearTimeout(pendingToggle.current)

      // Wait for segment double-tap handling before treating this as a single tap.
      if (
        (event.target as Element).closest(
          '[data-reader-segment-id][data-reader-mappable="true"]',
        )
      ) {
        pendingToggle.current = setTimeout(() => {
          setControlsVisible(!areControlsVisible)
        }, SEGMENT_DOUBLE_TAP_INTERVAL_MS)
      } else {
        setControlsVisible(!areControlsVisible)
      }
    }
  }

  return (
    <div
      ref={surface}
      role="region"
      aria-label="Reader"
      tabIndex={0}
      className="relative h-full w-full outline-none"
      onPointerDownCapture={recordPointerFocus}
      onClickCapture={clearPointerFocus}
      onPointerCancelCapture={clearPointerFocus}
      onFocusCapture={showControlsForKeyboardFocus}
      onKeyDownCapture={handleReaderKeyDown}
    >
      <div
        ref={gestureSurface}
        className={`h-full w-full ${isPdf ? '' : 'touch-pinch-zoom'}`}
        onClickCapture={suppressClickAfterSwipe}
        onPointerDown={recordGestureStart}
        onPointerMove={cancelTapAfterMovement}
        onPointerCancel={cancelGesture}
        onClick={toggleControlsForTap}
      >
        {children}
      </div>
      {controls && (
        <div
          ref={overlay}
          hidden={!areControlsVisible}
          className="pointer-events-none absolute inset-0 z-20 flex flex-col [&>*]:pointer-events-auto [&>header]:shrink-0"
          data-reader-controls
          data-reader-overlay
        >
          {controls}
        </div>
      )}
    </div>
  )
}
