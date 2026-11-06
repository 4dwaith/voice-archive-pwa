import 'fake-indexeddb/auto'
import { afterAll, beforeEach } from 'vitest'
import { database } from '../../src/data/database'

// Opt in only in suites using IndexedDB. Local hooks still own effect teardown.
beforeEach(async () => {
  await database.delete()
  await database.open()
})

afterAll(() => database.delete())
