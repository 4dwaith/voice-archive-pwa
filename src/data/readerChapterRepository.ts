import { database } from './database'
import { getContentSections } from './contentRepository'

// Half-open bounds in canonical segment sequence order.
type ReaderChapterRange = { start: number; end: number }

// Called inside a transaction. Counts, primary keys and source-key lookups prove
// availability without materializing segment text.
export async function readChapterAvailability(
  bookId: number,
  contentVersion: string,
) {
  const content = await database.content.get(bookId)

  if (content?.version !== contentVersion) return null

  const sections = await getContentSections(bookId)

  const hasAllSections =
    (content.complete || content.progress?.sectionNextOffset === null) &&
    sections.length === content.manifest.section_count

  if (!hasAllSections) return null

  const bookSegments = database.segments
    .where('[bookId+version]')
    .equals([bookId, contentVersion])

  const segmentCount = await bookSegments.count()
  const [lastSegmentKey] = await bookSegments.reverse().limit(1).primaryKeys()
  const lastSequenceOfLastSegment = lastSegmentKey?.[2] ?? null // segment primary key: [bookId+version+sequence]

  // The segments are fully downloaded
  const hasAllSegments =
    (content.complete || content.progress?.segmentNextOffset === null) &&
    segmentCount === content.manifest.segment_count

  // The segments are either partially or fully downloaded
  const hasSomeSegments =
    hasAllSegments ||
    (content.progress?.segmentNextOffset === segmentCount &&
      content.progress?.lastSegmentSequence === lastSequenceOfLastSegment)

  const rootChapters = sections.filter((section) => section.parent_id === null)
  const chapterIds = [
    'before',
    ...rootChapters.map((chapter) => String(chapter.id)),
  ]
  const downloadedChapterRanges = new Map<string, ReaderChapterRange>()

  if (hasSomeSegments) {
    const chapterStartSequences = await Promise.all(
      rootChapters.map(async (chapter) => {
        if (chapter.first_segment_source_key === null) return undefined

        const [firstSegmentKey] = await database.segments
          .where('[bookId+version+source_key]')
          .equals([bookId, contentVersion, chapter.first_segment_source_key])
          .primaryKeys()

        return firstSegmentKey?.[2] // segment primary key: [bookId+version+sequence]
      }),
    )

    let nextChapterStartSequence: number | undefined = hasAllSegments
      ? Infinity
      : undefined

    // Looping in reverse - the start of the current iteration is the end of the next iteration
    for (let rootIndex = rootChapters.length - 1; rootIndex >= 0; rootIndex--) {
      const chapter = rootChapters[rootIndex]
      const chapterId = String(chapter.id)

      if (chapter.first_segment_source_key === null) {
        downloadedChapterRanges.set(chapterId, { start: 0, end: 0 })
        continue
      }

      const startSequence = chapterStartSequences[rootIndex]

      if (startSequence !== undefined && nextChapterStartSequence !== undefined)
        downloadedChapterRanges.set(chapterId, {
          start: startSequence,
          end: nextChapterStartSequence,
        })

      nextChapterStartSequence = startSequence
    }

    // All unsectioned text before the first root chapter.
    if (nextChapterStartSequence !== undefined)
      downloadedChapterRanges.set('before', {
        start: 0,
        end: nextChapterStartSequence,
      })
  }

  return {
    chapterIds,
    downloadedChapterRanges,
    hasCompleteContent: hasAllSegments,
  }
}

// Only the requested complete chapter's payload is loaded. Sequence bounds also
// include unsectioned text after that root, without rewriting canonical owners.
export async function readChapterSegments(
  bookId: number,
  contentVersion: string,
  chapterId: string,
) {
  return database.transaction(
    'r',
    database.content,
    database.sections,
    database.segments,
    async () => {
      const chapterAvailability = await readChapterAvailability(
        bookId,
        contentVersion,
      )
      const range = chapterAvailability?.downloadedChapterRanges.get(chapterId)

      if (range === undefined) return undefined
      if (range.start === range.end) return []

      return database.segments
        .where('[bookId+version+sequence]')
        .between(
          [bookId, contentVersion, range.start],
          [bookId, contentVersion, range.end],
          true,
          false,
        )
        .toArray()
    },
  )
}

export async function readReaderChapterReadiness(
  bookId: number,
  contentVersion: string,
  layoutKey: string | null,
) {
  return database.transaction(
    'r',
    [
      database.content,
      database.sections,
      database.segments,
      database.measurements,
    ],
    async () => {
      const chapterAvailability = await readChapterAvailability(
        bookId,
        contentVersion,
      )

      if (!chapterAvailability) return null

      const committedMeasurements =
        layoutKey === null
          ? []
          : await database.measurements
              .where('[bookId+contentVersion+layoutKey]')
              .equals([bookId, contentVersion, layoutKey])
              .toArray()

      const pageCountsByChapter = new Map(
        committedMeasurements
          .filter((measurement) =>
            chapterAvailability.downloadedChapterRanges.has(
              measurement.chapterId,
            ),
          )
          .map((measurement) => [
            measurement.chapterId,
            measurement.pages.length,
          ]),
      )
      const readyChapterIds = new Set(pageCountsByChapter.keys())

      const firstUnmeasuredChapterIndex =
        chapterAvailability.chapterIds.findIndex(
          (id) => !readyChapterIds.has(id),
        )
      const indexedChapterIds = chapterAvailability.chapterIds.slice(
        0,
        firstUnmeasuredChapterIndex < 0
          ? undefined
          : firstUnmeasuredChapterIndex,
      )
      const indexedPageCount = indexedChapterIds.reduce(
        (sum, id) => sum + pageCountsByChapter.get(id)!,
        0,
      )

      const totalPageCount =
        chapterAvailability.hasCompleteContent &&
        firstUnmeasuredChapterIndex < 0
          ? indexedPageCount
          : null

      return {
        ...chapterAvailability,
        availableChapterIds: new Set(
          chapterAvailability.downloadedChapterRanges.keys(),
        ),
        readyChapterIds,
        countsByChapter: pageCountsByChapter,
        indexedChapterIds,
        indexedPageCount,
        totalPageCount,
      }
    },
  )
}
