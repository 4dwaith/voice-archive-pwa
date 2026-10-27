import { expect, it } from 'vitest'
import { resolvePageNumber } from '../../../src/components/atoms/ReaderProgressNavigation/resolvePageNumber'

it.each([
  ['relative', -2, 6, 1],
  ['relative', 2, 6, 2],
  ['relative', 4, 6, 4],
  ['relative', 8, 6, 6],
  ['absolute', 1, 6, 1],
  ['absolute', 6, 6, 6],
  ['absolute', 0, 6, null],
  ['absolute', -1, 6, null],
  ['absolute', 7, 6, null],
  ['absolute', 1.5, 6, null],
  ['absolute', NaN, 6, null],
  ['absolute', Infinity, 6, null],
  ['relative', 2, 0, null],
  ['absolute', 1, 0, null],
  ['relative', 2, null, null],
  ['absolute', 1, null, null],
] as const)(
  '%s page %s with count %s resolves to %s',
  (kind, requested, count, expected) => {
    const result = resolvePageNumber(requested, count, kind)

    expect(result.pageNumber).toBe(expected)
    expect(result.error === null).toBe(expected !== null)
  },
)
