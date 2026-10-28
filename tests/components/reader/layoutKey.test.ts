import { describe, expect, it } from 'vitest'
import {
  createLayoutKey,
  READER_LAYOUT_VERSION,
  type ReaderLayoutDescriptor,
} from '../../../src/components/atoms/ReaderChapterLayout/layoutKey'

function createDescriptor(): ReaderLayoutDescriptor {
  return {
    rendererVersion: READER_LAYOUT_VERSION,
    width: 320.4,
    height: 212,
    textSizePercent: 100,
    typography: ['Verdana', '16px', '26.4px', 'normal', 'normal'],
    fontEnvironment: 'local font metrics',
  }
}

describe('layout keys', () => {
  it('ignores content and presentation state outside the descriptor', async () => {
    const first = {
      ...createDescriptor(),
      bookId: 1,
      version: 'a',
      chapterId: 'one',
      page: 1,
      controlsVisible: true,
    }
    const second = {
      ...createDescriptor(),
      bookId: 2,
      version: 'b',
      chapterId: 'two',
      page: 9,
      controlsVisible: false,
    }

    expect(await createLayoutKey(first)).toBe(await createLayoutKey(second))
  })

  it.each<Partial<ReaderLayoutDescriptor>>([
    { width: 320.41 },
    { height: 212.01 },
    { textSizePercent: 112.5 },
    { typography: ['another family, size, line height or spacing'] },
    { fontEnvironment: 'changed fallback metrics' },
    { rendererVersion: 'next' },
  ])('changes for represented rendering conditions: %j', async (change) => {
    const descriptor = createDescriptor()

    expect(await createLayoutKey({ ...descriptor, ...change })).not.toBe(
      await createLayoutKey(descriptor),
    )
  })

  it.each([0, -1, NaN, Infinity])(
    'rejects unusable dimensions: %s',
    async (width) => {
      expect(await createLayoutKey({ ...createDescriptor(), width })).toBeNull()
    },
  )
})
