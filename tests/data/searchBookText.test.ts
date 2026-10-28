import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { database } from '../../src/data/database'
import {
  findTextMatches,
  isSearchQueryValid,
  searchBookText,
} from '../../src/data/searchBookText'
import { seedContent } from '../helpers/readerMeasurements'

const scope = { bookId: 7, contentVersion: 'version' }

describe('Literal search ranges and excerpts', () => {
  it.each(['', '  \n\t'])('rejects a blank phrase %j', (query) => {
    expect(isSearchQueryValid(query)).toBe(false)
    expect([...findTextMatches('text', query)]).toEqual([])
  })

  it('keeps case, punctuation and surrounding whitespace literal', () => {
    expect(
      [...findTextMatches('A.* a.* A.*', 'A.*')].map(({ offset }) => offset),
    ).toEqual([0, 8])
    expect(
      [...findTextMatches('ab ab', ' ab')].map(({ offset }) => offset),
    ).toEqual([2])
  })

  it('finds non-overlapping occurrences at code-point offsets', () => {
    const matches = [...findTextMatches('😀 aaaa 😀 aa', 'aa')]

    expect(matches.map(({ offset }) => offset)).toEqual([2, 4, 9])
  })

  it('preserves text with four non-whitespace context words per side', () => {
    const matches = [
      ...findTextMatches(
        'zero one\ttwo\nthree four <hit> five six seven eight nine',
        '<hit>',
      ),
    ]

    expect(matches).toEqual([
      {
        offset: 24,
        before: 'one\ttwo\nthree four ',
        match: '<hit>',
        after: ' five six seven eight',
      },
    ])
  })

  it('clamps context at segment edges and retains combining characters', () => {
    expect([...findTextMatches('e\u0301😀', '😀')]).toEqual([
      {
        offset: 2,
        before: 'e\u0301',
        match: '😀',
        after: '',
      },
    ])
  })

  it('preserves whitespace at segment edges without normalizing text', () => {
    expect([...findTextMatches('  e\u0301 hit \n', 'hit')]).toEqual([
      { offset: 5, before: '  e\u0301 ', match: 'hit', after: ' \n' },
    ])
    expect([...findTextMatches('e\u0301', 'é')]).toEqual([])
  })
})

describe('Complete local book search', () => {
  beforeEach(async () => {
    await database.delete()
    await database.open()
    await seedContent()
  })

  afterEach(async () => {
    await database.delete()
  })

  it('scans canonical text in document order without requiring measurements', async () => {
    const template = (await database.segments.get([7, 'version', 3]))!
    await database.segments.clear()
    await database.content.update(7, { 'manifest.segment_count': 3 })
    await database.segments.bulkPut([
      {
        ...template,
        id: 90,
        sequence: 0,
        root_section_id: null,
        section_id: null,
        text_content: 'hit',
      },
      { ...template, id: 8, sequence: 1, text_content: 'hit hit' },
      {
        ...template,
        id: 2,
        sequence: 2,
        root_section_id: null,
        section_id: null,
        text_content: 'hit',
      },
      { ...template, bookId: 8, text_content: 'hit' },
      { ...template, version: 'old', text_content: 'hit' },
    ])

    const results = await searchBookText(scope, 'hit')

    expect(
      results.map(({ segmentId, offset, chapterId, chapterTitle }) => [
        segmentId,
        offset,
        chapterId,
        chapterTitle,
      ]),
    ).toEqual([
      [90, 0, 'before', 'Before'],
      [8, 0, '10', 'Root'],
      [8, 4, '10', 'Root'],
      [2, 0, '10', 'Root'],
    ])
    expect(results[0]).toEqual({
      segmentId: 90,
      offset: 0,
      chapterId: 'before',
      chapterTitle: 'Before',
      before: '',
      match: 'hit',
      after: '',
    })
    expect(await searchBookText(scope, 'abc')).toEqual([])
  })

  it.each(['incomplete', 'version', 'missing segments', 'missing sections'])(
    'rejects %s content',
    async (change) => {
      if (change === 'incomplete')
        await database.content.update(7, { complete: false })
      if (change === 'version')
        await database.content.update(7, { version: 'new' })
      if (change === 'missing segments') await database.segments.clear()
      if (change === 'missing sections') await database.sections.clear()

      await expect(searchBookText(scope, 'abc')).rejects.toThrow(
        'Download this book',
      )
    },
  )
})
