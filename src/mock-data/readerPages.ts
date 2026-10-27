import type { ReaderSegment } from '../models/reader'

function createVerseSegment(
  id: number,
  prefix: string,
  lineCount: number,
): ReaderSegment {
  const lines = Array.from(
    { length: lineCount },
    (_, index) => `${prefix} line ${index + 1}`,
  )

  return {
    id,
    source_key: `verse-${id}`,
    kind: 'verse',
    html_content: `<p class="no-indent">${lines.join('<br>')}</p>`,
    text_content: lines.join('\n'),
    language: 'en',
  }
}

export const readerPageSegments: ReaderSegment[] = [
  createVerseSegment(101, 'First page', 8),
  createVerseSegment(102, 'Second page', 8),
  createVerseSegment(103, 'Third page', 8),
]

const longVerse = createVerseSegment(104, 'Continuing', 20)

export const continuingReaderSegment: ReaderSegment = {
  ...longVerse,
  html_content: `<p class="no-indent"><strong><em>${longVerse.text_content.replaceAll('\n', '<br>')}</em></strong></p>`,
}

const unbrokenText = 'W'.repeat(1000)

const flowingText = Array.from(
  { length: 80 },
  (_, index) => `word${String(index + 1).padStart(3, '0')}`,
).join(' ')

export const flowingReaderSegment: ReaderSegment = {
  id: 106,
  source_key: 'flowing-prose',
  kind: 'prose',
  html_content: `<p class="no-indent"><strong><em>${flowingText}</em></strong></p>`,
  text_content: flowingText,
  language: 'en',
}

export const unbrokenReaderSegment: ReaderSegment = {
  id: 105,
  source_key: 'unbroken',
  kind: 'prose',
  html_content: `<p class="no-indent">${unbrokenText}</p>`,
  text_content: unbrokenText,
  language: 'en',
}
