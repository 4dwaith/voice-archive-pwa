import type {
  ReaderLayoutMeasurement,
  ReaderSegment,
} from '../../../models/reader'
import { getGraphemeBoundaries } from './getGraphemeBoundaries'

export function measurePageBoundaries(
  columns: HTMLElement,
  segments: ReaderSegment[],
  pageCount: number,
  width: number,
  gap: number,
): Pick<ReaderLayoutMeasurement, 'pages' | 'unmappableSegmentIds'> {
  const pages: ReaderLayoutMeasurement['pages'] = Array.from(
    { length: pageCount },
    (_, index) => ({
      localPage: index + 1,
      start: null,
      end: null,
    }),
  )
  const unmappableSegmentIds: number[] = []
  const origin = columns.getBoundingClientRect().left
  const document = columns.ownerDocument

  for (const [index, segment] of segments.entries()) {
    const element = columns.children[index] as HTMLElement
    const starts: { node: Node; offset: number }[] = []
    const ends: typeof starts = []
    let text = ''
    const collectTextPositions = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const value = node.textContent ?? ''
        text += value
        for (let offset = 0; offset < value.length; offset++) {
          starts.push({ node, offset })
          ends.push({ node, offset: offset + 1 })
        }
      } else if (node.nodeName === 'BR') {
        const parent = node.parentNode!
        const offset = Array.from(parent.childNodes).indexOf(node as ChildNode)
        text += '\n'
        starts.push({ node: parent, offset })
        ends.push({ node: parent, offset: offset + 1 })
      } else node.childNodes.forEach(collectTextPositions)
    }
    collectTextPositions(element)

    if (
      element.dataset.readerMappable !== 'true' ||
      text !== segment.text_content
    ) {
      unmappableSegmentIds.push(segment.id)
      continue
    }

    const boundaries = getGraphemeBoundaries(text)
    const range = document.createRange()
    let localPage = Math.max(
      1,
      Math.min(
        pageCount,
        Math.floor(
          (element.getClientRects()[0].left - origin + 0.5) / (width + gap),
        ) + 1,
      ),
    )
    let previousRect: DOMRect | undefined
    for (let i = 1; i < boundaries.length; i++) {
      const start = boundaries[i - 1]
      const end = boundaries[i]
      range.setStart(starts[start.utf16].node, starts[start.utf16].offset)
      range.setEnd(ends[end.utf16 - 1].node, ends[end.utf16 - 1].offset)
      const rect = Array.from(range.getClientRects()).find(
        (rect) => rect.height > 0,
      )

      // Collapsed whitespace stays with the preceding fragment; br contributes LF.
      // A grapheme is indivisible even when it crosses inline element boundaries.
      if (rect && starts[start.utf16].node.nodeType === Node.TEXT_NODE)
        localPage = Math.max(
          1,
          Math.min(
            pageCount,
            Math.floor((rect.left - origin + 0.5) / (width + gap)) + 1,
          ),
        )

      // Chrome reports br x in the first column of a fragmented inline. Its y
      // still resets at a column break, including when a page starts with blank lines.
      if (
        rect &&
        starts[start.utf16].node.nodeType !== Node.TEXT_NODE &&
        previousRect &&
        rect.bottom <= previousRect.top
      ) {
        localPage = Math.min(pageCount, localPage + 1)
      }

      previousRect = rect ?? previousRect
      const page = pages[localPage - 1]
      page.start ??= {
        segmentId: segment.id,
        sourceKey: segment.source_key,
        offset: start.codePoint,
      }
      page.end = {
        segmentId: segment.id,
        sourceKey: segment.source_key,
        offset: end.codePoint,
      }
    }
  }
  return { pages, unmappableSegmentIds }
}
