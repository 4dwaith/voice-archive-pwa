import { createContext, useContext } from 'react'
import type { createLiveConversation } from '../services/liveConversation'

export const LiveContext = createContext<ReturnType<
  typeof createLiveConversation
> | null>(null)

export function useLiveConversation() {
  return useContext(LiveContext)
}
