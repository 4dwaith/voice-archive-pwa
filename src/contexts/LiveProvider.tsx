import { useEffect, useState, type ReactNode } from 'react'
import { createLiveConversation } from '../services/liveConversation'
import { apiBaseUrl } from '../api-client/baseApi'
import { LiveTokenResponse } from '../api-client/generated/schemas'
import { useAppStore } from '../store/hooks'
import { getReaderScope } from '../store/readerSlice'
import { setReaderAudioPlayback } from '../store/readerAudioSlice'
import { LiveContext } from './LiveContext'

export function LiveProvider({ children }: { children: ReactNode }) {
  // Fetch the store rather than the scope so that the value will always fetch the latest scope
  // Otherwise, the value would have to be recalculated on scope change, causing further renders.
  const store = useAppStore()
  const [conversation] = useState(() =>
    createLiveConversation(async (signal) => {
      // Credentials never enter Redux, query caches, storage or persisted history.
      const response = await fetch(new URL('/api/v1/live/token', apiBaseUrl), {
        method: 'POST',
        cache: 'no-store',
        signal,
      })
      if (!response.ok) throw new Error('Live provisioning failed')
      return LiveTokenResponse.parse(await response.json())
    }),
  )
  const [value] = useState(() => ({
    ...conversation,
    start() {
      const scope = getReaderScope(store.getState())
      if (scope)
        store.dispatch(setReaderAudioPlayback({ ...scope, isPlaying: false }))
      return conversation.start()
    },
  }))
  useEffect(() => () => conversation.stop(), [conversation])

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>
}
