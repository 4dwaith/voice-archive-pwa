import { requestLiveSession } from '../store/liveSlice'
import type { AppDispatch } from '../store/store'

export function endLiveSession(dispatch: AppDispatch) {
  dispatch(requestLiveSession({ kind: 'stop' }))
  return { accepted: true }
}
