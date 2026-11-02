import { database } from '../../src/data/database'
import pdfUrl from '../../cypress/fixtures/reader.pdf?url'
import {
  readerBookContent,
  readerBookSection,
  readerStoryProseSegment,
  readerStoryContentVersion,
  readerStoryParagraphs,
} from '../../src/mock-data/readerBook'

export type ReaderTocScenario =
  'standard' | 'overflowing' | 'unavailable' | 'partial' | 'search' | 'pdf'

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
  if (tocScenario === 'pdf')
    segments[0].regions = [
      { page_index: 0, x0: 0.2, y0: 0.25, x1: 0.8, y1: 0.35 },
      { page_index: 1, x0: 0.1, y0: 0.15, x1: 0.6, y1: 0.3 },
    ]
  if (tocScenario === 'search') {
    const text = `${segments[0].text_content}\nFind this river. Find this river again.`
    segments[0] = {
      ...segments[0],
      text_content: text,
      html_content: `${segments[0].html_content}\n<p>Find this river. Find this river again.</p>`,
    }
  }
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
          ...(tocScenario === 'pdf'
            ? {
                source_pdf_file_id: 9,
                files: [
                  {
                    id: 9,
                    kind: 'source_pdf' as const,
                    book_id: bookId,
                    section_id: null,
                    url: new URL(pdfUrl, window.location.href).href,
                    byte_size: 2000,
                    metadata: { page_count: 3 },
                  },
                ],
              }
            : {}),
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
