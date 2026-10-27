import { describe, expect, it } from 'vitest'
import { getGraphemeBoundaries } from '../../../src/components/atoms/ReaderChapterLayout/getGraphemeBoundaries'

describe('getGraphemeBoundaries', () => {
  it('preserves code points at grapheme boundaries', () => {
    // Kannada, combining accent, supplementary character, ZWJ emoji, LF and space.
    const text = 'ಕಾe\u0301😀👩‍💻\n '

    const boundaries = getGraphemeBoundaries(text)

    expect(boundaries).toEqual([
      { utf16: 0, codePoint: 0 },
      { utf16: 2, codePoint: 2 },
      { utf16: 4, codePoint: 4 },
      { utf16: 6, codePoint: 5 },
      { utf16: 11, codePoint: 8 },
      { utf16: 12, codePoint: 9 },
      { utf16: 13, codePoint: 10 },
    ])
  })

  it('returns the origin for empty text', () => {
    expect(getGraphemeBoundaries('')).toEqual([{ utf16: 0, codePoint: 0 }])
  })
})
