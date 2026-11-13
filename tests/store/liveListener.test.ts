// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLiveConversation } from '../../src/services/liveConversation'
import { createAppStore } from '../../src/store/store'
import { setCurrentUser } from '../../src/store/authSlice'
import {
  getLiveSession,
  initializeLiveSession,
  requestLiveSession,
} from '../../src/store/liveSlice'

vi.mock('../../src/services/liveConversation', () => ({
  createLiveConversation: vi.fn(),
}))

afterEach(() => vi.clearAllMocks())

describe('Live listener', () => {
  it('does not initialize or start Live for guests', () => {
    const store = createAppStore()

    store.dispatch(initializeLiveSession())
    store.dispatch(requestLiveSession({ kind: 'start' }))

    expect(createLiveConversation).not.toHaveBeenCalled()
  })

  it('starts synchronously without React and keeps reports scoped to its store', () => {
    const store = createAppStore()
    store.dispatch(
      setCurrentUser({
        id: 2,
        email: 'reader@example.com',
        display_name: null,
      }),
    )
    const otherStore = createAppStore()
    let publish = () => {}
    const conversation = {
      start: vi.fn(async () => {}),
      stop: vi.fn(),
      discard: vi.fn(),
      quiesceAudio: vi.fn(),
      resumeAudio: vi.fn(),
      sendCommandError: vi.fn(),
      getSnapshot: () => ({
        status: 'connected' as const,
        error: null,
        canContinue: false,
      }),
      subscribe: (notify: () => void) => {
        publish = notify
        return () => {}
      },
    }
    vi.mocked(createLiveConversation).mockReturnValue(conversation)

    store.dispatch(requestLiveSession({ kind: 'start' }))

    expect(conversation.start).toHaveBeenCalledOnce()
    expect(createLiveConversation).toHaveBeenCalledOnce()

    publish()

    expect(getLiveSession(store.getState()).status).toBe('connected')
    expect(getLiveSession(otherStore.getState()).status).toBe('idle')
  })
})
