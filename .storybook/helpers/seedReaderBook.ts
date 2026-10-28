import { database } from '../../src/data/database'
import {
  readerBookContent,
  readerBookSection,
  readerStoryProseSegment,
  readerStoryContentVersion,
  readerStoryParagraphs,
} from '../../src/mock-data/readerBook'

export type ReaderTocScenario =
  'standard' | 'overflowing' | 'unavailable' | 'partial'

// Scenario-owned records: seed idempotently, retaining committed measurements.
export async function seedReaderBook(
  bookId: number,
  hasChapter = false,
  tocScenario: ReaderTocScenario = 'standard',
) {
  const subsections = hasChapter
    ? Array.from(
        { length: tocScenario === 'overflowing' ? 32 : 1 },
        (_, index) => ({
          ...readerBookSection,
          bookId,
          version: readerStoryContentVersion,
          id: index + 2,
          parent_id: readerBookSection.id,
          sequence: index + 1,
          sibling_sequence: index,
          source_key: `nested-${index + 1}`,
          title:
            tocScenario === 'overflowing'
              ? `Section ${index + 1}: A reading destination`
              : tocScenario === 'unavailable'
                ? 'Empty section'
                : 'Nested section',
          kind: 'section' as const,
          first_segment_source_key:
            tocScenario === 'unavailable'
              ? null
              : index === 0
                ? readerStoryProseSegment.source_key
                : `section-text-${index + 1}`,
        }),
      )
    : []
  const segments = [
    {
      ...readerStoryProseSegment,
      bookId,
      section_id: hasChapter
        ? tocScenario === 'unavailable'
          ? readerBookSection.id
          : subsections[0].id
        : null,
      root_section_id: hasChapter ? readerBookSection.id : null,
    },
    ...subsections.slice(1).map((section, index) => ({
      ...readerStoryProseSegment,
      bookId,
      id: readerStoryProseSegment.id + index + 1,
      sequence: index + 1,
      source_key: section.first_segment_source_key!,
      section_id: section.id,
      root_section_id: readerBookSection.id,
      html_content: `<p>${readerStoryParagraphs[index % readerStoryParagraphs.length]}</p>`,
      text_content: readerStoryParagraphs[index % readerStoryParagraphs.length],
    })),
  ]

  const isPartial = tocScenario === 'partial'
  if (isPartial)
    segments.push({
      ...segments[0],
      id: segments[0].id + 1,
      sequence: 1,
      source_key: 'pending-chapter',
      section_id: readerBookSection.id,
      root_section_id: readerBookSection.id,
    })

  await database.open()
  await database.transaction(
    'rw',
    [database.content, database.sections, database.segments],
    async () => {
      await database.content.put({
        ...readerBookContent,
        bookId,
        version: readerStoryContentVersion,
        complete: !isPartial,
        progress: isPartial
          ? {
              sectionNextOffset: null,
              segmentNextOffset: 2,
              lastSegmentSequence: 1,
            }
          : undefined,
        manifest: {
          ...readerBookContent.manifest,
          content_version: readerStoryContentVersion,
          section_count: isPartial
            ? 1
            : hasChapter
              ? subsections.length + 1
              : 0,
          segment_count: segments.length + (isPartial ? 1 : 0),
        },
      })
      if (isPartial)
        await database.sections.put({
          ...readerBookSection,
          bookId,
          version: readerStoryContentVersion,
          first_segment_source_key: 'pending-chapter',
        })
      if (hasChapter)
        await database.sections.bulkPut([
          {
            ...readerBookSection,
            bookId,
            version: readerStoryContentVersion,
            first_segment_source_key: readerStoryProseSegment.source_key,
          },
          ...subsections,
        ])
      await database.segments.bulkPut(segments)
    },
  )
}
