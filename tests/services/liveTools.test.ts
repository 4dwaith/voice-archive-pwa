// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createLiveTools,
  liveToolDeclarations,
  type LiveEffectReceipts,
} from '../../src/services/liveTools'
import { createLiveQueries } from '../../src/services/liveQueries'
import { createAppStore } from '../../src/store/store'

afterEach(() => vi.unstubAllGlobals())

function createToolConnection() {
  const store = createAppStore()
  const queries = createLiveQueries(store.getState, store.dispatch)
  const stop = vi.fn()
  const tools = createLiveTools(queries, stop)
  const abort = new AbortController()
  const send = vi.fn()
  const receipts: LiveEffectReceipts = {}
  const connection = tools.connect(abort.signal, receipts, vi.fn(), send)
  return { queries, stop, tools, abort, send, receipts, connection }
}

describe('Live tools', () => {
  it('cleans parameter JSON schemas to strip patterns, bounds, and additionalProperties', () => {
    const rawDeclarations = JSON.stringify(liveToolDeclarations)

    expect(rawDeclarations).not.toContain('pattern')
    expect(rawDeclarations).not.toContain('additionalProperties')
    expect(rawDeclarations).not.toContain('9007199254740991')
    expect(liveToolDeclarations).toHaveLength(18)
  })

  it.each([
    { name: 'missing' },
    { name: 'ask_library', args: { bookId: 0, query: 'Why?' } },
    { name: 'ask_library', args: { bookId: 7, query: ' ' } },
    { name: 'ask_library', args: { bookId: 7, query: 'Why?', effort: 'max' } },
    { name: 'ask_library', args: { bookId: 7, query: 'Why?', extra: true } },
    { name: 'updateReaderSettings', args: {} },
    { name: 'updateReaderSettings', args: { playbackSpeed: 0.7 } },
    { name: 'updateReaderSettings', args: { playbackSpeed: 2.05 } },
    { name: 'updateReaderSettings', args: { playbackSpeed: 1.03 } },
    { name: 'updateReaderSettings', args: { textSize: 101 } },
    { name: 'getAppHelp', args: { topic: 'unknown' } },
    { name: 'getBookInfo', args: { bookId: -1 } },
    { name: 'endLiveSession', args: { extra: true } },
  ])('rejects invalid calls: $name', async (call) => {
    const { connection, send, stop } = createToolConnection()

    await connection.invoke({ id: 'invalid', ...call })

    expect(send.mock.calls[0][0].response.error).toContain('invalid arguments')
    expect(stop).not.toHaveBeenCalled()
  })

  it('does not repeat a relative command after restoring receipts', async () => {
    const store = createAppStore()
    const request = vi.fn()
    const tools = createLiveTools(
      createLiveQueries(store.getState, store.dispatch),
      vi.fn(),
      request,
    )
    const receipts: LiveEffectReceipts = {}
    const call = {
      id: 'move',
      name: 'moveTextPage',
      args: { direction: 'next' },
    }

    await tools
      .connect(new AbortController().signal, receipts, vi.fn(), vi.fn())
      .invoke(call)
    tools.clear()
    await tools
      .connect(
        new AbortController().signal,
        JSON.parse(JSON.stringify(receipts)),
        vi.fn(),
        vi.fn(),
      )
      .invoke(call)

    expect(request).toHaveBeenCalledExactlyOnceWith(
      { kind: 'moveTextPage', direction: 'next' },
      'move',
    )
  })

  it('replies synchronously and reuses matching reads', async () => {
    const { connection, queries, send } = createToolConnection()
    const read = vi.spyOn(queries, 'getAppHelp')
    const call = { id: 'same', name: 'getAppHelp', args: { topic: 'reader' } }

    const first = connection.invoke(call)

    expect(read).toHaveBeenCalledOnce()
    expect(send).toHaveBeenCalledOnce()

    await first
    await connection.invoke(call)
    await connection.invoke({ ...call, args: { topic: 'live' } })

    expect(read).toHaveBeenCalledOnce()
    expect(send.mock.calls[0][0]).toEqual(send.mock.calls[1][0])
    expect(send.mock.calls[2][0].response.error).toContain('Conflicting')
  })

  it.each(['tool cancellation', 'session stop'])(
    'aborts the pending answer HTTP request on %s',
    async (reason) => {
      const started = Promise.withResolvers<Request>()
      vi.stubGlobal(
        'fetch',
        vi.fn((request: Request) => {
          started.resolve(request)
          return new Promise<Response>((_resolve, reject) => {
            request.signal.addEventListener(
              'abort',
              () => {
                reject(new DOMException('Aborted', 'AbortError'))
              },
              { once: true },
            )
          })
        }),
      )
      const { connection, abort, send } = createToolConnection()
      const pending = connection.invoke({
        id: 'answer',
        name: 'ask_library',
        args: {
          bookId: 7,
          query: 'Why did the traveller return?',
          effort: 'medium',
        },
      })
      const request = await started.promise

      expect(request.url).toContain('/api/v1/library/ask')
      expect(await request.json()).toEqual({
        book_id: 7,
        query: 'Why did the traveller return?',
        effort: 'medium',
      })

      if (reason === 'tool cancellation') connection.cancel(['answer'])
      else abort.abort()
      await pending

      expect(request.signal.aborted).toBe(true)
      expect(send).not.toHaveBeenCalled()
    },
  )

  it('suppresses a cancelled delayed read', async () => {
    const { queries, connection, send } = createToolConnection()
    const pending = Promise.withResolvers<never>()
    vi.spyOn(queries, 'getBookInfo').mockReturnValue(pending.promise)
    const result = connection.invoke({
      id: 'slow',
      name: 'getBookInfo',
      args: { bookId: 7 },
    })
    const duplicate = connection.invoke({
      id: 'slow',
      name: 'getBookInfo',
      args: { bookId: 7 },
    })

    expect(queries.getBookInfo).toHaveBeenCalledOnce()

    connection.cancel(['slow'])
    pending.resolve({} as never)
    await Promise.all([result, duplicate])

    expect(send).not.toHaveBeenCalled()
  })

  it.each(['throw', 'reject'] as const)(
    'returns an information error when a query fails: %s',
    async (failure) => {
      const { queries, connection, send } = createToolConnection()
      vi.spyOn(queries, 'getBookInfo').mockImplementation(() => {
        if (failure === 'throw') throw new Error('unavailable')
        return Promise.reject(new Error('unavailable'))
      })

      await connection.invoke({
        id: 'failed',
        name: 'getBookInfo',
        args: { bookId: 7 },
      })

      expect(send.mock.calls[0][0].response.error).toContain(
        'Information unavailable',
      )
    },
  )

  it('persists acceptance before stopping and never repeats End on a restored connection', async () => {
    const { connection, tools, stop, receipts, send } = createToolConnection()
    const call = { id: '__proto__', name: 'endLiveSession' }

    const pending = connection.invoke(call)

    expect(stop).toHaveBeenCalledOnce()
    expect(Object.hasOwn(receipts, call.id)).toBe(true)

    await pending
    tools.clear()
    await tools
      .connect(
        new AbortController().signal,
        JSON.parse(JSON.stringify(receipts)),
        vi.fn(),
        send,
      )
      .invoke(call)

    expect(stop).toHaveBeenCalledOnce()
  })
})
