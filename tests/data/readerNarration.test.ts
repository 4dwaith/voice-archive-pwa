import '../helpers/database'
import { beforeEach, describe, expect, it } from 'vitest'
import { database } from '../../src/data/database'
import {
  readFileNarration,
  readNarrationTarget,
} from '../../src/data/readerNarration'
import { seedContent } from '../helpers/readerMeasurements'

const scope = { bookId: 7, contentVersion: 'version' }

describe('Reader narration lookup', () => {
  beforeEach(async () => {
    const content = await seedContent()
    content.manifest.files = [
      {
        id: 1,
        kind: 'audio_chapter',
        book_id: null,
        section_id: 10,
        byte_size: 100,
        url: '/api/v1/files/1',
        metadata: { duration_ms: 5000, sample_rate: 16000, channels: 1 },
      },
    ]
    await database.content.put(content)
    await database.segments.update([7, 'version', 6], {
      narration_start_ms: 1000,
      narration_end_ms: 2000,
    })
  })

  it('skips untimed opening text and uses the root audio URL', async () => {
    const target = await readNarrationTarget(scope, { segmentId: 1 })

    expect(target?.segment.id).toBe(2)
    expect(target?.fileId).toBe(1)
    expect(target?.url).toMatch(/\/api\/v1\/files\/1$/)
  })

  it('retains only cue fields for the requested root', async () => {
    const segment = (await database.segments.get([7, 'version', 6]))!
    await database.segments.put({
      ...segment,
      id: 3,
      sequence: 9,
      root_section_id: 20,
      html_content: '<p>Another root.</p>',
      text_content: 'Another root.',
    })

    const cues = await readFileNarration(scope, 10)

    expect(cues).toEqual([
      {
        id: 2,
        sequence: 6,
        section_id: 10,
        root_section_id: 10,
        narration_start_ms: 1000,
        narration_end_ms: 2000,
        narration_seek_ms: null,
      },
    ])
  })

  it('stops on missing root audio even when a nested section owns audio', async () => {
    await database.sections.put({
      ...(await database.sections.get([7, 'version', 10])),
      ...scope,
      version: 'version',
      id: 11,
      parent_id: 10,
      sequence: 1,
      sibling_sequence: 0,
      source_key: 'nested',
      title: 'Nested',
      kind: 'section',
      audio_file_id: null,
      first_segment_source_key: null,
    })
    await database.segments.update([7, 'version', 6], { section_id: 11 })
    const content = (await database.content.get(7))!
    content.manifest.files[0].section_id = 11
    await database.content.put(content)

    await expect(readNarrationTarget(scope, { segmentId: 2 })).rejects.toThrow(
      'root-section audio',
    )
  })

  it('distinguishes download gaps from completion', async () => {
    await database.content.update(7, { complete: false })

    expect(
      await readNarrationTarget(scope, { afterSequence: 6 }),
    ).toBeUndefined()

    await database.content.update(7, { complete: true })

    expect(await readNarrationTarget(scope, { afterSequence: 6 })).toBeNull()
  })

  it('skips remaining cues in an ended root file', async () => {
    const section = (await database.sections.get([7, 'version', 10]))!
    const segment = (await database.segments.get([7, 'version', 6]))!
    const content = (await database.content.get(7))!
    await database.sections.put({
      ...section,
      id: 20,
      source_key: 'next',
      sequence: 1,
    })
    await database.segments.put({
      ...segment,
      id: 3,
      sequence: 9,
      section_id: 20,
      root_section_id: 20,
      source_key: 'next-text',
    })
    content.manifest.files.push({
      ...content.manifest.files[0],
      id: 2,
      section_id: 20,
    })
    await database.content.put(content)

    const target = await readNarrationTarget(scope, {
      afterSequence: 3,
      skipRootId: 10,
    })

    expect(target?.segment.id).toBe(3)
    expect(target?.fileId).toBe(2)
  })
})
