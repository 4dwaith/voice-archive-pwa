import { useEffect, useRef, type ReactNode } from 'react'
import { useReaderContext } from '../../../contexts/ReaderContext'

export function ReaderControls({
  children,
  header,
}: {
  children: ReactNode
  header: ReactNode
}) {
  const { areControlsVisible, setControlsVisible } = useReaderContext().reader
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
          )
            setControlsVisible(!areControlsVisible)
        }}
      >
        {children}
      </div>
      <div
        ref={overlay}
        hidden={!areControlsVisible}
        className="absolute inset-x-0 top-0 z-20"
        data-reader-controls
        data-reader-overlay
      >
        {header}
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
