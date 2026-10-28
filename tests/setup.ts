import { beforeEach } from 'vitest'
import { READER_PREFERENCES_KEY } from '../src/data/readerPreferences'

beforeEach(() => {
  if (typeof localStorage !== 'undefined')
    localStorage.removeItem(READER_PREFERENCES_KEY)
})
