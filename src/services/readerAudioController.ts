import type { ReaderAnchor } from '../models/reader'
import type { NarrationTarget } from '../data/readerNarration'
import type { NarrationCue, ReaderAudioSnapshot } from '../models/readerAudio'

export const idleReaderAudioSnapshot: ReaderAudioSnapshot = {
  segment: null,
  speakingSegmentId: null,
  isPlaying: false,
  status: 'idle',
  error: null,
}

// React may replace a scoped controller while retaining its native audio element.
const mediaConnections = new WeakMap<HTMLAudioElement, AbortController>()

type TargetRequest = {
  segmentId?: number
  afterSequence?: number
  skipRootId?: number
}

type LoadedNarration = { target: NarrationTarget; segments: NarrationCue[] }

type PendingTarget = {
  request: TargetRequest
  fromFileStart: boolean
  wantsPlay: boolean
  loaded: LoadedNarration | null
}
type PlaybackState =
  | { kind: 'idle' | 'disposed' }
  | ({ kind: 'preparing' | 'awaitingContent' } & PendingTarget)
  | { kind: 'playing'; loaded: LoadedNarration; speakingId: number | null }
  | {
      kind: 'paused'
      loaded: LoadedNarration | null
      speakingId: number | null
      resumePosition: ReaderAnchor | null
    }
  | { kind: 'ended'; loaded: LoadedNarration | null }
  | { kind: 'error'; loaded: LoadedNarration | null; message: string }

export function createReaderAudioController(
  media: HTMLAudioElement,
  dependencies: {
    readTarget: (
      request: TargetRequest,
      signal: AbortSignal,
    ) => Promise<NarrationTarget | null | undefined>
    readFileSegments: (
      rootId: number,
      signal: AbortSignal,
    ) => Promise<NarrationCue[]>
    follow: (segment: NarrationCue) => void
  },
) {
  let playbackSpeed = 1
  function applyPlaybackSpeed() {
    media.preservesPitch = true
    media.defaultPlaybackRate = playbackSpeed
    media.playbackRate = playbackSpeed
  }

  let state: PlaybackState = { kind: 'idle' }
  let snapshot = idleReaderAudioSnapshot
  const subscribers = new Set<() => void>()
  let operation = new AbortController()
  let connection: AbortController | null = null
  let frame: number | null = null

  function readLoadedNarration() {
    return 'loaded' in state ? state.loaded : null
  }

  function hasPlayingIntent() {
    return (
      state.kind === 'playing' ||
      ((state.kind === 'preparing' || state.kind === 'awaitingContent') &&
        state.wantsPlay)
    )
  }

  function transition(next: PlaybackState) {
    state = next
    const nextSnapshot: ReaderAudioSnapshot = {
      segment: readLoadedNarration()?.target.segment ?? null,
      speakingSegmentId:
        state.kind === 'playing' || state.kind === 'paused'
          ? state.speakingId
          : null,
      isPlaying: hasPlayingIntent(),
      status:
        state.kind === 'playing'
          ? media.paused || media.readyState < 3
            ? 'buffering'
            : 'playing'
          : state.kind === 'awaitingContent'
            ? 'preparing'
            : state.kind === 'disposed'
              ? 'idle'
              : state.kind,
      error: state.kind === 'error' ? state.message : null,
    }
    if (
      nextSnapshot.segment !== snapshot.segment ||
      nextSnapshot.speakingSegmentId !== snapshot.speakingSegmentId ||
      nextSnapshot.isPlaying !== snapshot.isPlaying ||
      nextSnapshot.status !== snapshot.status ||
      nextSnapshot.error !== snapshot.error
    ) {
      snapshot = nextSnapshot
      subscribers.forEach((notify) => notify())
    }
    scheduleClock()
  }

  function replaceOperation() {
    operation.abort()
    operation = new AbortController()
    return operation.signal
  }

  function reportFailure(error: unknown) {
    const loaded = readLoadedNarration()
    operation.abort()
    media.pause()
    transition({
      kind: 'error',
      loaded,
      message:
        error instanceof Error
          ? error.message
          : 'The audio could not be played. Try Play again.',
    })
  }

  async function startMedia(signal: AbortSignal) {
    if (signal.aborted || state.kind !== 'playing') return
    try {
      await media.play()
      // play() cannot be aborted. A late completion must respect the current state,
      // including a newer play request that now owns the same native element.
      const owner = mediaConnections.get(media)
      if (state.kind !== 'playing' && (!owner || owner === connection))
        media.pause()
      if (!signal.aborted) sampleClock()
    } catch (error) {
      if (!signal.aborted) reportFailure(error)
    }
  }

  function waitForMetadata(signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
      signal.throwIfAborted()
      const listeners = new AbortController()
      function finish(error?: unknown) {
        listeners.abort()
        signal.removeEventListener('abort', cancel)
        if (error !== undefined) reject(error)
        else resolve()
      }
      function cancel() {
        finish(signal.reason)
      }
      signal.addEventListener('abort', cancel, { once: true })
      media.addEventListener('loadedmetadata', () => finish(), {
        signal: listeners.signal,
      })
      media.addEventListener(
        'error',
        () =>
          finish(
            new Error('The audio file could not be loaded. Try Play again.'),
          ),
        { signal: listeners.signal },
      )
    })
  }

  async function prepareTarget(
    request: TargetRequest,
    wantsPlay: boolean,
    fromFileStart = false,
  ) {
    if (state.kind === 'disposed') return
    const loaded = readLoadedNarration()
    const signal = replaceOperation()
    media.pause()
    transition({ kind: 'preparing', request, wantsPlay, fromFileStart, loaded })
    try {
      const target = await dependencies.readTarget(request, signal)
      signal.throwIfAborted()
      if (target === undefined) {
        transition({
          kind: 'awaitingContent',
          request,
          wantsPlay,
          fromFileStart,
          loaded,
        })
        return
      }
      if (target === null) {
        transition({ kind: 'ended', loaded })
        return
      }
      if (
        loaded?.target.fileId !== target.fileId ||
        media.getAttribute('src') !== target.url ||
        media.readyState === 0
      ) {
        const ready = waitForMetadata(signal)
        media.src = target.url
        media.load()
        await ready
        signal.throwIfAborted()
      }
      const segments = await dependencies.readFileSegments(
        target.segment.root_section_id!,
        signal,
      )
      signal.throwIfAborted()
      applyPlaybackSpeed()
      media.currentTime = fromFileStart
        ? 0
        : (target.segment.narration_seek_ms ??
            target.segment.narration_start_ms!) / 1000
      const prepared = { target, segments }
      const shouldPlay = hasPlayingIntent()
      transition(
        shouldPlay
          ? { kind: 'playing', loaded: prepared, speakingId: null }
          : {
              kind: 'paused',
              loaded: prepared,
              speakingId: null,
              resumePosition: null,
            },
      )
      sampleClock()
      if (shouldPlay) await startMedia(signal)
    } catch (error) {
      if (!signal.aborted) reportFailure(error)
    }
  }

  function sampleClock() {
    if ((state.kind !== 'playing' && state.kind !== 'paused') || !state.loaded)
      return
    const previous = state
    const { target, segments } = state.loaded
    const milliseconds = media.currentTime * 1000
    const isWithinInterval = (segment: NarrationCue) =>
      milliseconds >= segment.narration_start_ms! &&
      milliseconds < segment.narration_end_ms!
    const match =
      segments.find(
        (segment) =>
          segment.id === target.segment.id && isWithinInterval(segment),
      ) ?? segments.find(isWithinInterval)
    const speakingId =
      match && (state.kind === 'playing' || state.speakingId === match.id)
        ? match.id
        : null
    const loaded =
      match && match !== target.segment
        ? { ...state.loaded, target: { ...target, segment: match } }
        : state.loaded
    transition({ ...state, loaded, speakingId })
    if (
      speakingId !== previous.speakingId &&
      speakingId !== null &&
      previous.kind === 'playing'
    )
      dependencies.follow(loaded.target.segment)
  }

  function sampleVisibleClock() {
    frame = null
    sampleClock()
  }

  function scheduleClock() {
    if (
      state.kind === 'playing' &&
      media.ownerDocument.visibilityState !== 'hidden'
    ) {
      if (frame === null) frame = requestAnimationFrame(sampleVisibleClock)
    } else if (frame !== null) {
      cancelAnimationFrame(frame)
      frame = null
    }
  }

  function pausePlayback(
    position: ReaderAnchor | null = null,
    restartFromPage = false,
  ) {
    if (state.kind === 'disposed') return
    const loaded = readLoadedNarration()
    const ready =
      state.kind === 'playing' || state.kind === 'paused' ? state : null
    const speakingId = !restartFromPage ? (ready?.speakingId ?? null) : null
    replaceOperation()
    media.pause()
    transition({
      kind: 'paused',
      loaded,
      speakingId,
      resumePosition:
        !restartFromPage && ready && position ? { ...position } : null,
    })
  }

  function playFromSegment(
    segmentId: number,
    position: ReaderAnchor | null = null,
  ) {
    if (state.kind === 'disposed') return
    if (
      (state.kind === 'preparing' || state.kind === 'awaitingContent') &&
      state.request.segmentId === segmentId
    ) {
      transition({ ...state, wantsPlay: true })
      return
    }
    if (
      state.kind === 'paused' &&
      state.loaded &&
      media.readyState > 0 &&
      state.resumePosition !== null &&
      position !== null &&
      state.resumePosition.segmentId === position.segmentId &&
      state.resumePosition.offset === position.offset
    ) {
      const signal = replaceOperation()
      transition({
        kind: 'playing',
        loaded: state.loaded,
        speakingId: state.speakingId,
      })
      sampleClock()
      void startMedia(signal)
    } else void prepareTarget({ segmentId }, true)
  }

  async function seekBySeconds(seconds: number) {
    if (
      (state.kind !== 'playing' && state.kind !== 'paused') ||
      !state.loaded ||
      !Number.isFinite(seconds) ||
      !Number.isFinite(media.duration)
    )
      return
    const signal = replaceOperation()
    media.currentTime = Math.max(
      0,
      Math.min(media.duration, media.currentTime + seconds),
    )
    if (media.currentTime >= media.duration) {
      const loaded = state.loaded
      transition({ kind: 'ended', loaded })
      media.pause()
    } else {
      sampleClock()
      await startMedia(signal)
    }
  }

  function handleMediaEnd() {
    if (state.kind !== 'playing') return
    const segment = state.loaded.target.segment
    // Timestamp boundaries only change presentation. Continue at native file end.
    void prepareTarget(
      { afterSequence: segment.sequence, skipRootId: segment.root_section_id! },
      true,
      true,
    )
  }

  function handleMediaError() {
    if (state.kind === 'playing' || state.kind === 'paused')
      reportFailure(
        new Error('The audio file could not be played. Try Play again.'),
      )
  }

  return {
    subscribe(notify: () => void) {
      subscribers.add(notify)
      return () => {
        subscribers.delete(notify)
      }
    },
    getSnapshot: () => snapshot,
    // Construction is side-effect free. connect/dispose also support React's effect replay.
    connect() {
      if (connection && !connection.signal.aborted) return
      connection = new AbortController()
      mediaConnections.set(media, connection)
      const options = { signal: connection.signal }
      if (state.kind === 'disposed') transition({ kind: 'idle' })
      for (const event of ['timeupdate', 'playing', 'waiting', 'seeked'])
        media.addEventListener(event, sampleClock, options)
      media.addEventListener('ended', handleMediaEnd, options)
      media.addEventListener('error', handleMediaError, options)
      media.ownerDocument.addEventListener(
        'visibilitychange',
        () => {
          sampleClock()
          scheduleClock()
        },
        options,
      )
    },
    setPlaybackSpeed(rate: number) {
      playbackSpeed = rate
      applyPlaybackSpeed()
    },
    playFromSegment,
    pausePlayback,
    seekBySeconds,
    selectSegment(segmentId: number | null) {
      if (segmentId !== null)
        void prepareTarget({ segmentId }, hasPlayingIntent())
      else if (state.kind === 'paused')
        transition({ ...state, resumePosition: null })
    },
    async refreshContent() {
      if (state.kind === 'awaitingContent') {
        void prepareTarget(state.request, state.wantsPlay, state.fromFileStart)
        return
      }
      if (
        (state.kind !== 'playing' && state.kind !== 'paused') ||
        !state.loaded
      )
        return
      const rootId = state.loaded.target.segment.root_section_id!
      const signal = operation.signal
      try {
        const segments = await dependencies.readFileSegments(rootId, signal)
        signal.throwIfAborted()
        if (
          (state.kind === 'playing' || state.kind === 'paused') &&
          state.loaded?.target.segment.root_section_id === rootId
        ) {
          transition({ ...state, loaded: { ...state.loaded, segments } })
          sampleClock()
        }
      } catch (error) {
        if (!signal.aborted) reportFailure(error)
      }
    },
    readProgress() {
      const segment = readLoadedNarration()?.target.segment
      if (!segment) return 0
      const duration = segment.narration_end_ms! - segment.narration_start_ms!
      const elapsed = media.currentTime * 1000 - segment.narration_start_ms!
      return duration > 0 &&
        Number.isFinite(duration) &&
        Number.isFinite(elapsed)
        ? Math.max(0, Math.min(1, elapsed / duration))
        : 0
    },
    dispose() {
      if (state.kind === 'disposed') return
      operation.abort()
      connection?.abort()
      if (mediaConnections.get(media) === connection)
        mediaConnections.delete(media)
      transition({ kind: 'disposed' })
      media.pause()
      if (media.getAttribute('src')) {
        media.removeAttribute('src')
        media.load()
      }
    },
  }
}
