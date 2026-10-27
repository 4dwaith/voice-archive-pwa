import type { ReaderSegment } from '../models/reader'

// Small synthetic examples grounded in the canonical importer's HTML tests.
export const readerSegments: ReaderSegment[] = [
  {
    id: 1,
    source_key: 'heading',
    kind: 'heading',
    html_content: '<h2>A small beginning</h2>',
    text_content: 'A small beginning',
    language: 'en',
  },
  {
    id: 2,
    source_key: 'prose',
    kind: 'prose',
    html_content:
      '<p>A <strong>bold <em>and italic</em></strong> phrase &amp; literal &lt;markup&gt;.</p>',
    text_content: 'A bold and italic phrase & literal <markup>.',
    language: 'en',
  },
  {
    id: 3,
    source_key: 'verse',
    kind: 'verse',
    html_content:
      '<p class="align-right no-indent gap-before gap-after">One line<br>Another&nbsp;line<br>🌕 é</p>',
    text_content: 'One line\nAnother line\n🌕 é',
    language: 'en',
  },
  {
    id: 4,
    source_key: 'kannada',
    kind: 'prose',
    html_content:
      '<p class="align-left no-indent">ಕನ್ನಡ ಗೀತಾಭಾವಧಾರೆ — é 👩‍👩‍👧‍👦</p>',
    text_content: 'ಕನ್ನಡ ಗೀತಾಭಾವಧಾರೆ — é 👩‍👩‍👧‍👦',
    language: 'kn',
  },
  {
    id: 5,
    source_key: 'center',
    kind: 'prose',
    html_content:
      '<p class="align-center no-indent gap-before gap-after">◆</p>',
    text_content: '◆',
    language: null,
  },
]

export const arbitraryClassSegment: ReaderSegment = {
  id: 6,
  source_key: 'unknown-classes',
  kind: 'prose',
  html_content:
    '<p class="hidden fixed opacity-0 text-red-500 reader-segment-error future-style hover:hidden">These classes cannot hide or recolor the reader.</p>',
  text_content: 'These classes cannot hide or recolor the reader.',
  language: 'en',
}

export const unsafeReaderSegment: ReaderSegment = {
  id: 7,
  source_key: 'unsafe',
  kind: 'prose',
  html_content:
    '<p onclick="alert(1)">Rejected text <img src="/must-not-load.png" onerror="alert(1)" alt=""></p>',
  text_content: 'Rejected text ',
  language: 'en',
}
