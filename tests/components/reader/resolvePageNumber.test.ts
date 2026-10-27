import { describe, expect, it } from 'vitest'
import {
  resolvePageNumber,
  resolvePageNumberFromFraction,
} from '../../../src/components/atoms/ReaderProgressNavigation/resolvePageNumber'

describe('resolvePageNumber', () => {
  it.each([
    [-22, 1],
    [0, 1],
    [1, 1],
    [4, 4],
    [6, 6],
    [28, 6],
  ])('clamps page %s to %s', (requested, expected) => {
    expect(resolvePageNumber(requested, 6)).toBe(expected)
  })

  it.each([1.5, NaN, Infinity])('rejects %s', (requested) => {
    expect(resolvePageNumber(requested, 6)).toBeNull()
  })

  it('returns no page for an empty range', () => {
    expect(resolvePageNumber(1, 0)).toBeNull()
  })

  it('returns no page for an unknown range', () => {
    expect(resolvePageNumber(1, null)).toBeNull()
  })
})

describe('resolvePageNumberFromFraction', () => {
  it.each([
    [-0.1, 1],
    [0, 1],
    [0.25, 4],
    [0.999, 12],
    [1, 12],
    [1.1, 12],
  ])('maps %s to page %s', (fraction, expected) => {
    expect(resolvePageNumberFromFraction(fraction, 12)).toBe(expected)
  })
})
