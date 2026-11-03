import { useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { useGesture } from '@use-gesture/react'
import * as Dialog from '@radix-ui/react-dialog'
import { useReaderContext } from '../../../contexts/ReaderContext'
import { ReaderSegmentContent } from '../../atoms/ReaderSegmentContent/ReaderSegmentContent'
import { ReaderProgressNavigation } from '../../atoms/ReaderProgressNavigation/ReaderProgressNavigation'
import { ReaderAudioButton } from './ReaderAudioButton'
import { ReaderModeSwitch } from './ReaderModeSwitch'
import { scrollNarrationToProgress } from './scrollNarration'
import type { ReaderSegment } from '../../../models/reader'

function NarrationText({
  segment,
  textSizePercent,
  readProgress,
  seekBySeconds,
}: {
  segment: ReaderSegment
  textSizePercent: number
  readProgress: () => number
  seekBySeconds: (seconds: number) => void
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const text = useRef<HTMLDivElement>(null)

  useGesture(
    {
      onDrag: ({
        first,
        last,
        movement: [dx, dy],
        touches,
        canceled,
        memo,
      }) => {
        const gesture: { isBlocked: boolean } = first
          ? { isBlocked: false }
          : memo
        if (!gesture) return
        if (touches > 1 || canceled) gesture.isBlocked = true
        const major = Math.max(Math.abs(dx), Math.abs(dy))
        const minor = Math.min(Math.abs(dx), Math.abs(dy))
        if (last && !gesture.isBlocked && major >= 48 && major >= minor * 1.5)
          seekBySeconds((Math.abs(dx) >= Math.abs(dy) ? dx : dy) < 0 ? 5 : -5)
        return gesture
      },
      onWheel: ({ first, event }) => {
        if (event.ctrlKey) return
        event.preventDefault()
        const delta =
          Math.abs(event.deltaY) >= Math.abs(event.deltaX)
            ? event.deltaY
            : event.deltaX
        if (first && delta !== 0) seekBySeconds(Math.sign(delta) * 5)
      },
    },
    {
      target: viewport,
      eventOptions: { passive: false },
      drag: { pointer: { touch: true, capture: false, keys: false } },
    },
  )

  useLayoutEffect(() => {
    const scrollToNarration = () => {
      if (viewport.current && text.current)
        scrollNarrationToProgress(
          viewport.current,
          text.current,
          readProgress(),
          segment.text_content,
        )
    }
    scrollToNarration()
    const timer = setInterval(scrollToNarration, 200)
    const observer = new ResizeObserver(scrollToNarration)
    observer.observe(viewport.current!)
    observer.observe(text.current!)
    document.fonts.addEventListener('loadingdone', scrollToNarration)
    return () => {
      clearInterval(timer)
      observer.disconnect()
      document.fonts.removeEventListener('loadingdone', scrollToNarration)
    }
  }, [segment, readProgress, textSizePercent])

  return (
    <div
      ref={viewport}
      role="region"
      tabIndex={0}
      aria-label="Narrated text"
      className="min-h-0 flex-1 touch-pinch-zoom overflow-hidden overscroll-contain p-5 leading-[1.65] focus-visible:outline-4 focus-visible:outline-accent"
      style={{ fontSize: (24 * textSizePercent) / 100 }}
    >
      <div ref={text}>
        <ReaderSegmentContent segment={segment} />
      </div>
    </div>
  )
}

export function ReaderNarration() {
  const { audio, areControlsVisible, textSizePercent } =
    useReaderContext().reader
  const title = useRef<HTMLHeadingElement>(null)
  const isOpen = !!(audio?.isPlaying && audio.isSegmentSplit && audio.segment)

  function seekWithNarrationKey(event: KeyboardEvent<HTMLDivElement>) {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.nativeEvent.isComposing ||
      (event.target as Element).closest(
        'button, a, input, select, textarea, [role="slider"], [contenteditable="true"]',
      )
    )
      return
    const seconds = ['PageDown', 'ArrowRight', 'ArrowDown'].includes(event.key)
      ? 5
      : ['PageUp', 'ArrowLeft', 'ArrowUp'].includes(event.key)
        ? -5
        : null
    if (seconds === null) return
    event.preventDefault()
    if (!event.repeat) audio?.seekBySeconds(seconds)
  }

  if (!audio) return null
  if (!isOpen)
    return !areControlsVisible ? (
      <div className="absolute right-2 top-2 z-30">
        <ReaderAudioButton />
        {audio.error && (
          <p role="alert" className="max-w-xs bg-page p-2">
            {audio.error}
          </p>
        )}
      </div>
    ) : null

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) audio.pausePlayback()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          aria-describedby={undefined}
          onKeyDown={seekWithNarrationKey}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            title.current?.focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            requestAnimationFrame(() =>
              [
                ...document.querySelectorAll<HTMLButtonElement>(
                  '[data-reader-audio-control]',
                ),
              ]
                .find(
                  (button) =>
                    !button.disabled && button.getClientRects().length > 0,
                )
                ?.focus(),
            )
          }}
          className="fixed inset-2 z-50 flex flex-col border-2 border-ink bg-page text-ink"
        >
          <header className="flex shrink-0 flex-wrap items-center gap-2 border-b-2 border-ink p-2">
            <Dialog.Title
              ref={title}
              tabIndex={-1}
              className="mr-auto text-lg font-bold"
            >
              Narration
            </Dialog.Title>
            <ReaderModeSwitch />
            {!areControlsVisible && <ReaderAudioButton />}
            <Dialog.Close className="min-h-12 border-2 border-ink px-3 font-bold">
              Close
            </Dialog.Close>
          </header>
          <NarrationText
            segment={audio.segment!}
            textSizePercent={textSizePercent}
            readProgress={audio.readProgress}
            seekBySeconds={audio.seekBySeconds}
          />
          {areControlsVisible && (
            <div className="max-h-[45%] shrink-0 overflow-auto">
              <ReaderProgressNavigation />
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
