import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { SEGMENT_DOUBLE_TAP_INTERVAL_MS } from '../../atoms/ReaderSegmentContent/ReaderSegmentContent'
import { useReaderContext } from '../../../contexts/ReaderContext'

const INTERACTIVE_TARGETS =
  'button, a, input, select, textarea, summary, [role="button"], [role="slider"], [contenteditable]:not([contenteditable="false"])'

export function ReaderControls({
  children,
  controls,
}: {
  children: ReactNode
  controls?: ReactNode
}) {
  const { areControlsVisible, setControlsVisible, selectedSegmentId, pdf } =
    useReaderContext().reader
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
  const overlay = useRef<HTMLDivElement>(null)
  const isPointerFocus = useRef(false)
  const isReturningFocus = useRef(false)
  const pointer = useRef<{
    x: number
    y: number
    canToggle: boolean
    canSwipe: boolean
    pointerId: number
    startedAt: number
  } | null>(null)

  useEffect(() => {
    const element = surface.current!
    let gesture: {
      touches: Touch[]
      startedAt: number
      dx: number
      dy: number
    } | null = null

    function cancelModeSwipe() {
      gesture = null
    }

    function startModeSwipe(event: TouchEvent) {
      gesture = null
      if (event.touches.length !== 2 || !setViewMode) return
      pointer.current = null
      if (pendingToggle.current !== null) clearTimeout(pendingToggle.current)
      const touches = Array.from(event.touches).sort(
        (a, b) => a.identifier - b.identifier,
      )
      if (
        touches.some(
          (touch) =>
            (touch.target as Element).closest(INTERACTIVE_TARGETS) ||
            overlay.current?.contains(touch.target as Node),
        )
      )
        return
      gesture = { touches, startedAt: event.timeStamp, dx: 0, dy: 0 }
    }

    function trackModeSwipe(event: TouchEvent) {
      if (!gesture) return
      const current = Array.from(event.touches).sort(
        (a, b) => a.identifier - b.identifier,
      )
      const start = gesture.touches
      if (
        current.length !== 2 ||
        current.some(
          (touch, index) => touch.identifier !== start[index].identifier,
        ) ||
        event.timeStamp - gesture.startedAt > 600
      ) {
        cancelModeSwipe()
        return
      }
      const dx = current.map(
        (touch, index) => touch.clientX - start[index].clientX,
      )
      const dy = current.map(
        (touch, index) => touch.clientY - start[index].clientY,
      )
      const initialSpan = Math.hypot(
        start[1].clientX - start[0].clientX,
        start[1].clientY - start[0].clientY,
      )
      // A change in finger spacing or direction belongs to native pinch/rotation.
      if (
        Math.hypot(dx[1] - dx[0], dy[1] - dy[0]) >
        Math.max(12, initialSpan * 0.15)
      ) {
        cancelModeSwipe()
        return
      }
      gesture.dx = (dx[0] + dx[1]) / 2
      gesture.dy = (dy[0] + dy[1]) / 2
      if (
        Math.abs(gesture.dy) > 12 &&
        Math.abs(gesture.dy) >= Math.abs(gesture.dx)
      ) {
        cancelModeSwipe()
        return
      }
      if (
        dx[0] * dx[1] > 0 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5
      ) {
        if (!event.cancelable) {
          cancelModeSwipe()
          return
        }
        event.preventDefault()
      }
    }

    function finishModeSwipe(event: TouchEvent) {
      const completed = gesture
      gesture = null
      if (
        !completed ||
        !setViewMode ||
        event.timeStamp - completed.startedAt > 600 ||
        Math.abs(completed.dx) < 48 ||
        Math.abs(completed.dx) < Math.abs(completed.dy) * 1.5
      )
        return
      event.preventDefault()
      event.stopPropagation()
      suppressClick.current = true
      setViewMode(isPdf ? 'text' : 'pdf')
    }

    element.addEventListener('touchstart', startModeSwipe, {
      capture: true,
      passive: true,
    })
    element.addEventListener('touchmove', trackModeSwipe, {
      capture: true,
      passive: false,
    })
    element.addEventListener('touchend', finishModeSwipe, {
      capture: true,
      passive: false,
    })
    element.addEventListener('touchcancel', cancelModeSwipe, true)
    return () => {
      element.removeEventListener('touchstart', startModeSwipe, true)
      element.removeEventListener('touchmove', trackModeSwipe, true)
      element.removeEventListener('touchend', finishModeSwipe, true)
      element.removeEventListener('touchcancel', cancelModeSwipe, true)
    }
  }, [setViewMode, isPdf])

  const previousMode = useRef(isPdf)
  useEffect(() => {
    if (previousMode.current !== isPdf)
      surface.current?.focus({ preventScroll: true })
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

  function requestPageMove(delta: number) {
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

  function showControlsForKeyboardFocus() {
    if (!isPdf && !isPointerFocus.current && !isReturningFocus.current)
      setControlsVisible(true)
  }

  function handleReaderKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // React portals bubble through this component, but modal keys belong to the modal.
    if (!event.currentTarget.contains(event.target as Node)) return
    if (isPdf) return
    isPointerFocus.current = false

    const delta = ['PageDown', 'ArrowRight', 'ArrowDown'].includes(event.key)
      ? 1
      : ['PageUp', 'ArrowLeft', 'ArrowUp'].includes(event.key)
        ? -1
        : null
    const selection = event.currentTarget.ownerDocument.getSelection()

    // Reading keys must leave overlay controls and native text selection alone.
    if (
      delta !== null &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      !overlay.current?.contains(event.target as Node) &&
      !(event.target as Element).closest(INTERACTIVE_TARGETS) &&
      (!selection || selection.isCollapsed)
    ) {
      event.preventDefault()
      if (!event.repeat) {
        // Page changes can replace focused text; keep later keys on the reader.
        isReturningFocus.current = true
        surface.current?.focus({ preventScroll: true })
        isReturningFocus.current = false
        requestPageMove(delta)
      }
      return
    }

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
      canSwipe: canToggle && event.pointerType === 'touch',
      pointerId: event.pointerId,
      startedAt: event.timeStamp,
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

  function navigateWithSwipe(event: PointerEvent<HTMLDivElement>) {
    const start = pointer.current
    if (!start || start.pointerId !== event.pointerId) return

    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.hypot(dx, dy) > 4) start.canToggle = false
    const selection = event.currentTarget.ownerDocument.getSelection()

    if (
      !start.canSwipe ||
      event.timeStamp - start.startedAt > 600 ||
      (selection && !selection.isCollapsed)
    )
      return

    // Require a short, deliberate swipe with one clearly dominant direction.
    const major = Math.max(Math.abs(dx), Math.abs(dy))
    const minor = Math.min(Math.abs(dx), Math.abs(dy))
    if (major < 48 || major < minor * 1.5) return

    // The browser may emit a click after pointer-up; consume it after paging.
    pointer.current = null
    suppressClick.current = true
    event.preventDefault()
    requestPageMove((Math.abs(dx) >= Math.abs(dy) ? dx : dy) < 0 ? 1 : -1)
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
      onPointerUpCapture={clearPointerFocus}
      onPointerCancelCapture={clearPointerFocus}
      onFocusCapture={showControlsForKeyboardFocus}
      onKeyDownCapture={handleReaderKeyDown}
    >
      <div
        className={`h-full w-full ${isPdf ? '' : 'touch-pinch-zoom'}`}
        onClickCapture={suppressClickAfterSwipe}
        onPointerDown={recordGestureStart}
        onPointerMove={cancelTapAfterMovement}
        onPointerCancel={cancelGesture}
        onPointerUp={navigateWithSwipe}
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
