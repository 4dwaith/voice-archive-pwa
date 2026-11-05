// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import {
  createLiveTools,
  type LiveEffectReceipts,
} from '../../src/services/liveTools'
import { createLiveQueries } from '../../src/services/liveQueries'
import { createAppStore } from '../../src/store/store'

function createToolConnection() {
  const queries = createLiveQueries(createAppStore().getState)
  const stop = vi.fn()
  const tools = createLiveTools(queries, stop)
  const abort = new AbortController()
  const send = vi.fn()
  const receipts: LiveEffectReceipts = {}
  const connection = tools.connect(abort.signal, receipts, vi.fn(), send)
  return { queries, stop, tools, abort, send, receipts, connection }
}

describe('Live tools', () => {
  it.each([
    { name: 'missing' },
    { name: 'getAppHelp', args: { topic: 'unknown' } },
    { name: 'getBookDownloadState', args: { bookId: 0 } },
    { name: 'endLiveSession', args: { extra: true } },
  ])('rejects invalid calls: $name', async (call) => {
    const { connection, send, stop } = createToolConnection()

    await connection.invoke({ id: 'invalid', ...call })

    expect(send.mock.calls[0][0].response.error).toContain('invalid arguments')
    expect(stop).not.toHaveBeenCalled()
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

  it('suppresses a cancelled delayed read', async () => {
    const { queries, connection, send } = createToolConnection()
    const pending = Promise.withResolvers<never>()
    vi.spyOn(queries, 'getBookDownloadState').mockReturnValue(pending.promise)
    const result = connection.invoke({
      id: 'slow',
      name: 'getBookDownloadState',
      args: { bookId: 7 },
    })
    const duplicate = connection.invoke({
      id: 'slow',
      name: 'getBookDownloadState',
      args: { bookId: 7 },
    })

    expect(queries.getBookDownloadState).toHaveBeenCalledOnce()

    connection.cancel(['slow'])
    pending.resolve({} as never)
    await Promise.all([result, duplicate])

    expect(send).not.toHaveBeenCalled()
  })

  it.each(['throw', 'reject'] as const)(
    'returns an information error when a query fails: %s',
    async (failure) => {
      const { queries, connection, send } = createToolConnection()
      vi.spyOn(queries, 'getBookDownloadState').mockImplementation(() => {
        if (failure === 'throw') throw new Error('unavailable')
        return Promise.reject(new Error('unavailable'))
      })

      await connection.invoke({
        id: 'failed',
        name: 'getBookDownloadState',
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
