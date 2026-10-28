import { useEffect, useRef, type ReactNode } from 'react'
import { SEGMENT_DOUBLE_TAP_INTERVAL_MS } from '../../atoms/ReaderSegmentContent/ReaderSegmentContent'
import { useReaderContext } from '../../../contexts/ReaderContext'

export function ReaderControls({
  children,
  controls,
}: {
  children: ReactNode
  controls: ReactNode
}) {
  const { areControlsVisible, setControlsVisible, selectedSegmentId } =
    useReaderContext().reader
  const pendingToggle = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (pendingToggle.current !== null) clearTimeout(pendingToggle.current)
    },
    [areControlsVisible, selectedSegmentId],
  )
  const toggle = useRef<HTMLButtonElement>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const isPointerFocus = useRef(false)
  const isReturningFocus = useRef(false)
  const pointer = useRef<{
    x: number
    y: number
    canToggle: boolean
  } | null>(null)

  useEffect(() => {
    if (
      !areControlsVisible &&
      overlay.current?.contains(document.activeElement)
    ) {
      isReturningFocus.current = true
      toggle.current?.focus({ preventScroll: true })
      isReturningFocus.current = false
    }
  }, [areControlsVisible])

  return (
    <div
      className="relative h-full w-full"
      onPointerDownCapture={() => {
        isPointerFocus.current = true
      }}
      onPointerUpCapture={() => {
        isPointerFocus.current = false
      }}
      onPointerCancelCapture={() => {
        isPointerFocus.current = false
      }}
      onFocusCapture={() => {
        if (!isPointerFocus.current && !isReturningFocus.current)
          setControlsVisible(true)
      }}
      onKeyDownCapture={(event) => {
        isPointerFocus.current = false
        if (event.key === 'Escape') {
          event.preventDefault()
          setControlsVisible(false)
        } else if (event.target !== toggle.current) {
          setControlsVisible(true)
        }
      }}
    >
      <div
        className="h-full w-full"
        onPointerDown={(event) => {
          const selection = event.currentTarget.ownerDocument.getSelection()
          pointer.current = {
            x: event.clientX,
            y: event.clientY,
            canToggle:
              event.isPrimary &&
              event.button === 0 &&
              (!selection || selection.isCollapsed),
          }
        }}
        onPointerMove={(event) => {
          const start = pointer.current
          if (
            start &&
            Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4
          )
            start.canToggle = false
        }}
        onPointerCancel={() => {
          pointer.current = null
        }}
        onClick={(event) => {
          const start = pointer.current
          pointer.current = null
          const selection = event.currentTarget.ownerDocument.getSelection()
          if (
            start?.canToggle &&
            event.button === 0 &&
            !(event.target as Element).closest(
              'button, a, input, select, textarea, [role="button"]',
            ) &&
            (!selection || selection.isCollapsed)
          ) {
            if (pendingToggle.current !== null)
              clearTimeout(pendingToggle.current)
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
        }}
      >
        {children}
      </div>
      <div
        ref={overlay}
        hidden={!areControlsVisible}
        className="pointer-events-none absolute inset-0 z-20 flex flex-col [&>*]:pointer-events-auto [&>header]:shrink-0"
        data-reader-controls
        data-reader-overlay
      >
        {controls}
      </div>
      <button
        ref={toggle}
        type="button"
        aria-expanded={areControlsVisible}
        className="absolute right-3 bottom-3 z-20 min-h-12 rounded-xl border-2 border-ink bg-page px-4 font-bold focus-visible:outline-4 focus-visible:outline-accent"
        onClick={() => setControlsVisible(!areControlsVisible)}
      >
        {areControlsVisible ? 'Hide reader controls' : 'Show reader controls'}
      </button>
    </div>
  )
}
