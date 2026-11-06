// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createReaderAudioController } from '../../src/services/readerAudioController'
import type { ReaderAudioSnapshot } from '../../src/models/readerAudio'
import type { NarrationTarget } from '../../src/data/readerNarration'

type AudioDependencies = Parameters<typeof createReaderAudioController>[1]

function createTarget(
  id: number,
  start: number,
  end: number,
  fileId = 1,
  seek = start,
): NarrationTarget {
  return {
    fileId,
    url: `http://localhost/audio/${fileId}.wav`,
    segment: {
      id,
      sequence: id,
      section_id: fileId,
      root_section_id: fileId,
      narration_start_ms: start,
      narration_end_ms: end,
      narration_seek_ms: seek,
    },
  }
}

describe('Reader audio controller', () => {
  let media: HTMLAudioElement
  let isPaused: boolean
  let controller: ReturnType<typeof createReaderAudioController>
  let targets: NarrationTarget[]
  let canLoad: boolean
  let report: ReturnType<typeof vi.fn<(snapshot: ReaderAudioSnapshot) => void>>
  let follow: ReturnType<typeof vi.fn<AudioDependencies['follow']>>
  let readTarget: ReturnType<typeof vi.fn<AudioDependencies['readTarget']>>
  let readFileSegments: ReturnType<
    typeof vi.fn<AudioDependencies['readFileSegments']>
  >

  beforeEach(() => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    report = vi.fn()
    follow = vi.fn()
    readTarget = vi.fn()
    readFileSegments = vi.fn(async (rootId) =>
      targets
        .filter((target) => target.fileId === rootId)
        .map((target) => target.segment),
    )
    targets = [createTarget(1, 1000, 3000, 1, 500), createTarget(2, 3000, 5000)]
    canLoad = true
    isPaused = true
    media = document.createElement('audio')
    Object.defineProperties(media, {
      paused: { get: () => isPaused },
      readyState: { get: () => 4 },
      duration: { get: () => 20 },
    })
    media.pause = vi.fn(() => {
      isPaused = true
    })
    media.play = vi.fn(async () => {
      isPaused = false
      media.dispatchEvent(new Event('playing'))
    })
    media.load = vi.fn(() => {
      if (canLoad)
        queueMicrotask(() => media.dispatchEvent(new Event('loadedmetadata')))
    })
    readTarget.mockImplementation(
      async (request) =>
        targets
          .filter(
            (target) => target.segment.root_section_id !== request.skipRootId,
          )
          .find((target) =>
            request.segmentId !== undefined
              ? target.segment.id >= request.segmentId
              : target.segment.sequence > (request.afterSequence ?? -1),
          ) ?? null,
    )
    controller = createReaderAudioController(media, {
      readTarget,
      follow,
      readFileSegments,
    })
    controller.subscribe(() => report(controller.getSnapshot()))
    controller.connect()
  })

  afterEach(() => {
    controller.dispose()
    vi.unstubAllGlobals()
  })

  it.each([0.75, 1.35, 2])(
    'keeps highlighting on the media timeline at %sx',
    async (rate) => {
      controller.playFromSegment(1)
      await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())
      media.currentTime = 1.5
      media.dispatchEvent(new Event('timeupdate'))
      const pauseCount = vi.mocked(media.pause).mock.calls.length
      follow.mockClear()

      controller.setPlaybackSpeed(rate)

      expect(media.playbackRate).toBe(rate)
      expect(media.defaultPlaybackRate).toBe(rate)
      expect(media.preservesPitch).toBe(true)
      expect(media.currentTime).toBe(1.5)
      expect(controller.getSnapshot().speakingSegmentId).toBe(1)
      expect(follow).not.toHaveBeenCalled()
      expect(media.pause).toHaveBeenCalledTimes(pauseCount)
      expect(media.play).toHaveBeenCalledOnce()

      media.currentTime = 3.2
      media.dispatchEvent(new Event('timeupdate'))

      expect(controller.getSnapshot().speakingSegmentId).toBe(2)
      expect(follow).toHaveBeenLastCalledWith(targets[1].segment)
      expect(controller.readProgress()).toBeCloseTo(0.1)
    },
  )

  it('keeps snapshots stable when only the native clock changes', async () => {
    controller.playFromSegment(1)
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())
    const snapshot = controller.getSnapshot()
    report.mockClear()

    media.currentTime = 0.7
    media.dispatchEvent(new Event('timeupdate'))

    expect(controller.getSnapshot()).toBe(snapshot)
    expect(report).not.toHaveBeenCalled()
  })

  it('unsubscribes listeners without stopping the player', async () => {
    const notify = vi.fn()
    const unsubscribe = controller.subscribe(notify)
    unsubscribe()

    controller.playFromSegment(1)
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())

    expect(notify).not.toHaveBeenCalled()
    expect(controller.getSnapshot().isPlaying).toBe(true)
  })

  it('schedules animation frames only during playback', async () => {
    expect(requestAnimationFrame).not.toHaveBeenCalled()

    controller.playFromSegment(1)
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())

    expect(requestAnimationFrame).toHaveBeenCalledOnce()

    controller.pausePlayback()
    media.dispatchEvent(new Event('timeupdate'))

    expect(cancelAnimationFrame).toHaveBeenCalledExactlyOnceWith(1)
    expect(requestAnimationFrame).toHaveBeenCalledOnce()
  })

  it('reconnects after effect cleanup without retaining old playback', async () => {
    controller.playFromSegment(1)
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())

    controller.dispose()
    controller.connect()
    controller.playFromSegment(2)

    await vi.waitFor(() => expect(media.play).toHaveBeenCalledTimes(2))
    expect(controller.getSnapshot().segment?.id).toBe(2)
    expect(controller.getSnapshot().isPlaying).toBe(true)
  })

  it('keeps lead-in unhighlighted and follows speech from the native clock', async () => {
    controller.playFromSegment(1)

    await vi.waitFor(() =>
      expect(report).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'playing' }),
      ),
    )
    expect(media.currentTime).toBe(0.5)
    expect(follow).not.toHaveBeenCalled()

    media.currentTime = 1.2
    media.dispatchEvent(new Event('timeupdate'))

    expect(follow).toHaveBeenCalledWith(targets[0].segment)
    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({ speakingSegmentId: 1 }),
    )
  })

  it('updates contiguous highlights without touching playback', async () => {
    controller.playFromSegment(1)
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())
    const pauseCount = vi.mocked(media.pause).mock.calls.length

    media.currentTime = 3.05
    media.dispatchEvent(new Event('timeupdate'))

    await vi.waitFor(() =>
      expect(follow).toHaveBeenLastCalledWith(targets[1].segment),
    )
    expect(media.load).toHaveBeenCalledOnce()
    expect(media.currentTime).toBe(3.05)
    expect(media.pause).toHaveBeenCalledTimes(pauseCount)
    expect(media.play).toHaveBeenCalledOnce()
    expect(readTarget).toHaveBeenCalledOnce()
  })

  it.each([
    { name: 'backward', next: createTarget(2, 500, 900) },
    { name: 'forward', next: createTarget(2, 7000, 9000) },
  ])(
    'keeps playing the file across $name timestamp discontinuities',
    async ({ next }) => {
      targets[1] = next
      controller.playFromSegment(1)
      await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())
      const pauseCount = vi.mocked(media.pause).mock.calls.length

      media.currentTime = 3.2
      media.dispatchEvent(new Event('timeupdate'))

      expect(media.currentTime).toBe(3.2)
      expect(media.pause).toHaveBeenCalledTimes(pauseCount)
      expect(media.play).toHaveBeenCalledOnce()
      expect(media.load).toHaveBeenCalledOnce()
      expect(report).toHaveBeenLastCalledWith(
        expect.objectContaining({ isPlaying: true, speakingSegmentId: null }),
      )
    },
  )

  it('resumes an ordinary pause at the exact media position', async () => {
    controller.playFromSegment(1)
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())
    media.currentTime = 1.7
    media.dispatchEvent(new Event('timeupdate'))

    controller.pausePlayback({ segmentId: 1, offset: 0 })
    controller.playFromSegment(1, { segmentId: 1, offset: 0 })

    await vi.waitFor(() => expect(media.play).toHaveBeenCalledTimes(2))
    expect(media.currentTime).toBe(1.7)
    expect(readTarget).toHaveBeenCalledOnce()
  })

  it('clears speech feedback when pausing for navigation', async () => {
    controller.playFromSegment(1)
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())
    media.currentTime = 1.7
    media.dispatchEvent(new Event('timeupdate'))
    follow.mockClear()

    controller.pausePlayback(null, true)
    media.dispatchEvent(new Event('timeupdate'))

    expect(media.paused).toBe(true)
    expect(follow).not.toHaveBeenCalled()
    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({ isPlaying: false, speakingSegmentId: null }),
    )
  })

  it.each([
    {
      name: 'another anchor',
      position: { segmentId: 2, offset: 0 },
      restart: false,
    },
    {
      name: 'an explicit jump to the same anchor',
      position: { segmentId: 1, offset: 0 },
      restart: true,
    },
  ])('restarts after $name', async ({ position, restart }) => {
    controller.playFromSegment(1)
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())
    media.currentTime = 1.7

    controller.pausePlayback({ segmentId: 1, offset: 0 }, restart)
    controller.playFromSegment(1, position)

    await vi.waitFor(() => expect(media.play).toHaveBeenCalledTimes(2))
    expect(media.currentTime).toBe(0.5)
    expect(readTarget).toHaveBeenCalledTimes(2)
  })

  it.each([1000, 500])(
    'returns finite progress for an end time of %i',
    async (end) => {
      targets[0] = createTarget(1, 1000, end)
      controller.playFromSegment(1)
      await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())

      media.currentTime = 1

      expect(controller.readProgress()).toBe(0)
    },
  )

  it.each([true, false])(
    'retargets explicit selection with playing intent %s',
    async (isPlaying) => {
      if (isPlaying) {
        controller.playFromSegment(1)
        await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())
      }

      controller.selectSegment(2)

      await vi.waitFor(() =>
        expect(report).toHaveBeenLastCalledWith(
          expect.objectContaining({
            segment: expect.objectContaining({ id: 2 }),
            isPlaying,
            status: isPlaying ? 'playing' : 'paused',
          }),
        ),
      )
      expect(media.currentTime).toBe(3)
      expect(follow).toHaveBeenCalledTimes(isPlaying ? 1 : 0)
    },
  )

  it('plays the complete file tail before marking completion', async () => {
    controller.playFromSegment(2)
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())
    const pauseCount = vi.mocked(media.pause).mock.calls.length

    media.currentTime = 5
    media.dispatchEvent(new Event('timeupdate'))

    expect(media.paused).toBe(false)
    expect(media.pause).toHaveBeenCalledTimes(pauseCount)
    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({ isPlaying: true, speakingSegmentId: null }),
    )

    media.currentTime = 20
    media.dispatchEvent(new Event('ended'))

    await vi.waitFor(() =>
      expect(report).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: 'ended',
          isPlaying: false,
          speakingSegmentId: null,
        }),
      ),
    )
    expect(media.paused).toBe(true)
  })

  it('changes chapter files only on the native ended event', async () => {
    targets.push(createTarget(3, 1000, 4000, 2))
    controller.setPlaybackSpeed(1.35)
    controller.playFromSegment(1)
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())

    media.currentTime = 5.5
    media.dispatchEvent(new Event('timeupdate'))

    expect(media.getAttribute('src')).toBe(targets[0].url)
    expect(media.play).toHaveBeenCalledOnce()

    media.currentTime = 20
    media.dispatchEvent(new Event('ended'))

    await vi.waitFor(() =>
      expect(media.getAttribute('src')).toBe(targets[2].url),
    )
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledTimes(2))
    expect(media.currentTime).toBe(0)
    expect(media.playbackRate).toBe(1.35)
    expect(media.preservesPitch).toBe(true)
    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isPlaying: true,
        segment: expect.objectContaining({ id: 3 }),
        speakingSegmentId: null,
      }),
    )

    media.currentTime = 4.5
    media.dispatchEvent(new Event('timeupdate'))

    expect(controller.getSnapshot().segment?.id).toBe(3)
    expect(controller.getSnapshot().speakingSegmentId).toBeNull()
  })

  it('resolves file skips and clears highlights through gaps', async () => {
    targets[1] = createTarget(2, 7000, 9000)
    controller.playFromSegment(1)
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())

    await controller.seekBySeconds(5)

    expect(media.currentTime).toBe(5.5)
    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({ speakingSegmentId: null, isPlaying: true }),
    )

    media.currentTime = 7.2
    media.dispatchEvent(new Event('timeupdate'))

    expect(follow).toHaveBeenLastCalledWith(targets[1].segment)

    await controller.seekBySeconds(30)

    expect(media.currentTime).toBe(20)
    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'ended', isPlaying: false }),
    )
  })

  it('retains the current segment when intervals are reused', async () => {
    targets[1] = createTarget(2, 1000, 3000)
    controller.playFromSegment(2)
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())

    await controller.seekBySeconds(0.5)

    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({ speakingSegmentId: 2 }),
    )
  })

  it('cancels autoplay while metadata is loading', async () => {
    canLoad = false
    controller.playFromSegment(1)
    await vi.waitFor(() => expect(media.load).toHaveBeenCalledOnce())

    controller.pausePlayback()
    media.dispatchEvent(new Event('loadedmetadata'))
    await Promise.resolve()

    expect(media.play).not.toHaveBeenCalled()
    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({ isPlaying: false, status: 'paused' }),
    )
  })

  it('includes cues downloaded while metadata is loading', async () => {
    canLoad = false
    controller.playFromSegment(1)
    await vi.waitFor(() => expect(media.load).toHaveBeenCalledOnce())

    targets.push(createTarget(3, 5000, 7000))
    await controller.refreshContent()
    media.dispatchEvent(new Event('loadedmetadata'))
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())

    media.currentTime = 5.5
    media.dispatchEvent(new Event('timeupdate'))

    expect(controller.getSnapshot().speakingSegmentId).toBe(3)
    expect(follow).toHaveBeenLastCalledWith(targets[2].segment)
  })

  it('plays an in-flight selection without loading the file again', async () => {
    canLoad = false
    controller.selectSegment(2)
    await vi.waitFor(() => expect(media.load).toHaveBeenCalledOnce())

    controller.playFromSegment(2)
    media.dispatchEvent(new Event('loadedmetadata'))

    await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())
    expect(media.load).toHaveBeenCalledOnce()
    expect(readTarget).toHaveBeenCalledOnce()
    expect(controller.getSnapshot().segment?.id).toBe(2)
  })

  it('keeps a late play promise paused after cancellation', async () => {
    let finishPlaying!: () => void
    media.play = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishPlaying = () => {
            isPaused = false
            resolve()
          }
        }),
    )
    controller.playFromSegment(1)
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())

    controller.pausePlayback()
    finishPlaying()
    await Promise.resolve()

    expect(media.paused).toBe(true)
    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'paused', isPlaying: false }),
    )
  })

  it('keeps newer playback running when an obsolete play promise finishes', async () => {
    let finishOld!: () => void
    vi.mocked(media.play).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishOld = () => {
            isPaused = false
            resolve()
          }
        }),
    )
    controller.playFromSegment(1)
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())

    controller.selectSegment(2)
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledTimes(2))
    finishOld()
    await Promise.resolve()

    expect(media.paused).toBe(false)
    expect(controller.getSnapshot().segment?.id).toBe(2)
  })

  it('leaves a replacement controller playing when disposed playback finishes', async () => {
    let finishOld!: () => void
    vi.mocked(media.play).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishOld = () => {
            isPaused = false
            resolve()
          }
        }),
    )
    controller.playFromSegment(1)
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())

    controller.dispose()
    const replacement = createReaderAudioController(media, {
      readTarget,
      readFileSegments,
      follow,
    })
    replacement.connect()
    replacement.playFromSegment(2)
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledTimes(2))
    finishOld()
    await Promise.resolve()

    expect(media.paused).toBe(false)
    expect(replacement.getSnapshot().segment?.id).toBe(2)

    replacement.dispose()
  })

  it('ignores an obsolete lookup after a later selection', async () => {
    let resolveOld!: (target: NarrationTarget) => void
    readTarget.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve
        }),
    )
    controller.playFromSegment(1)

    controller.selectSegment(2)
    expect(readTarget.mock.calls[0][1].aborted).toBe(true)
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())
    resolveOld(targets[0])
    await Promise.resolve()

    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({ segment: expect.objectContaining({ id: 2 }) }),
    )
    expect(media.currentTime).toBe(3)
  })

  it('ignores old file cues after selecting another chapter', async () => {
    targets.push(createTarget(3, 1000, 4000, 2))
    let resolveOld!: (segments: NarrationTarget['segment'][]) => void
    readFileSegments.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve
        }),
    )
    controller.playFromSegment(1)
    await vi.waitFor(() => expect(readFileSegments).toHaveBeenCalledOnce())

    controller.selectSegment(3)
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())
    resolveOld([targets[0].segment])
    await Promise.resolve()
    media.currentTime = 1.5
    media.dispatchEvent(new Event('timeupdate'))

    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({
        segment: expect.objectContaining({ id: 3 }),
        speakingSegmentId: 3,
      }),
    )
    expect(media.getAttribute('src')).toBe(targets[2].url)
  })

  it('waits for an incomplete content stream', async () => {
    readTarget.mockResolvedValueOnce(undefined)
    controller.playFromSegment(1)
    await vi.waitFor(() =>
      expect(report).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'preparing' }),
      ),
    )
    await Promise.resolve()

    controller.refreshContent()

    await vi.waitFor(() => expect(media.play).toHaveBeenCalledOnce())
  })

  it('reports rejected playback without retrying in the background', async () => {
    media.play = vi.fn().mockRejectedValue(new Error('Playback was blocked.'))

    controller.playFromSegment(1)

    await vi.waitFor(() =>
      expect(report).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: 'error',
          isPlaying: false,
          error: 'Playback was blocked.',
        }),
      ),
    )
    expect(media.play).toHaveBeenCalledOnce()
  })
})
