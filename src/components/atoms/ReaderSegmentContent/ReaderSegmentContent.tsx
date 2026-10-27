import { createElement, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import type { ReaderSegment } from '../../../models/reader'
import { useReaderContext } from '../../../contexts/ReaderContext'
import {
  sanitizeReaderSegment,
  type ReaderContentNode,
} from './sanitizeReaderSegment'
import './ReaderSegmentContent.css'

function renderContentNodes(nodes: ReaderContentNode[]): ReactNode {
  return nodes.map((node, index) =>
    typeof node === 'string'
      ? node
      : createElement(
          node.tag,
          { key: index, className: node.className || undefined },
          ...(node.tag === 'br' ? [] : [renderContentNodes(node.children)]),
        ),
  )
}

export function ReaderSegmentContent({
  segment,
  isKeyboardEntry = false,
}: {
  segment: ReaderSegment
  // The containing reader chooses ONE entry point; other segments stay out of Tab order.
  isKeyboardEntry?: boolean
}) {
  const {
    selectedSegmentId,
    highlightedSegmentId,
    selectSegment,
    reportSegmentError,
  } = useReaderContext()
  const result = useMemo(() => sanitizeReaderSegment(segment), [segment])
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const hasDragged = useRef(false)
  const isSelected = selectedSegmentId === segment.id
  const error = result.isValid ? null : result.error

  useEffect(() => {
    reportSegmentError({ segmentId: segment.id, error })
  }, [segment.id, error, reportSegmentError])

  return (
    <div
      className="reader-segment leading-[1.65] wrap-anywhere text-ink focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      data-reader-segment-id={segment.id}
      data-reader-source-key={segment.source_key}
      data-reader-kind={segment.kind}
      data-reader-selected={isSelected || undefined}
      data-reader-highlighted={highlightedSegmentId === segment.id || undefined}
      lang={segment.language ?? undefined}
      tabIndex={
        result.isValid &&
        (isSelected || (selectedSegmentId === null && isKeyboardEntry))
          ? 0
          : -1
      }
      onPointerDown={(event) => {
        pointerStart.current = { x: event.clientX, y: event.clientY }
        hasDragged.current = false
      }}
      onPointerMove={(event) => {
        if (
          pointerStart.current &&
          Math.hypot(
            event.clientX - pointerStart.current.x,
            event.clientY - pointerStart.current.y,
          ) > 4
        ) {
          hasDragged.current = true
        }
      }}
      onPointerCancel={() => {
        hasDragged.current = true
        pointerStart.current = null
      }}
      onClick={(event) => {
        const selection = event.currentTarget.ownerDocument.getSelection()
        if (
          result.isValid &&
          event.button === 0 &&
          !hasDragged.current &&
          (!selection || selection.isCollapsed)
        ) {
          selectSegment(segment.id)
        }
        pointerStart.current = null
      }}
      onKeyDown={(event) => {
        if (
          result.isValid &&
          event.target === event.currentTarget &&
          (event.key === 'Enter' || event.key === ' ')
        ) {
          event.preventDefault()
          selectSegment(segment.id)
        }
      }}
    >
      {result.isValid ? (
        renderContentNodes(result.nodes)
      ) : (
        <p className="reader-segment-error">
          This text segment could not be displayed safely.
        </p>
      )}
    </div>
  )
}
