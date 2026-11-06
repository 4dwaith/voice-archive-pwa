import {
  requestReaderCommand,
  cancelReaderCommands,
  type ReaderCommand,
} from '../store/readerCommandsSlice'
import { requestLiveSession } from '../store/liveSlice'
import type { AppDispatch } from '../store/store'

export function endLiveSession(dispatch: AppDispatch) {
  dispatch(requestLiveSession({ kind: 'stop' }))
  return { accepted: true }
}

export function createLiveCommands(dispatch: AppDispatch) {
  return {
    endLiveSession: () => endLiveSession(dispatch),
    cancel: () => dispatch(cancelReaderCommands()),
    request(command: ReaderCommand, requestId: string) {
      const action = requestReaderCommand(command, requestId)
      dispatch(action)
      return { accepted: true, requestId: action.payload.requestId }
    },
  }
}
