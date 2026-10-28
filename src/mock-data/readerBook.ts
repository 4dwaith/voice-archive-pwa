import type {
  CachedContent,
  CachedSection,
  CachedSegment,
} from '../models/content'
import { continuingReaderSegment } from './readerPages'

export const readerBookContent: CachedContent = {
  bookId: 91001,
  version: 'reader-story-1',
  complete: true,
  manifest: {
    state: 'published',
    content_version: 'reader-story-1',
    schema_version: 1,
    imported_at: '2026-10-28T00:00:00Z',
    source_pdf_file_id: null,
    section_count: 0,
    segment_count: 1,
    files: [],
  },
}

export const readerBookSection: CachedSection = {
  bookId: 91001,
  version: 'reader-story-1',
  id: 1,
  parent_id: null,
  sequence: 0,
  sibling_sequence: 0,
  source_key: 'chapter',
  title: 'Chapter',
  kind: 'chapter',
  audio_file_id: null,
  first_segment_source_key: continuingReaderSegment.source_key,
}

export const readerBookSegment: CachedSegment = {
  ...continuingReaderSegment,
  bookId: 91001,
  version: 'reader-story-1',
  sequence: 0,
  section_id: null,
  root_section_id: null,
  regions: [],
  page_indexes: [],
  narration_start_ms: null,
  narration_end_ms: null,
  narration_seek_ms: null,
  alignment_status: null,
  alignment_metadata: null,
}

// Story prose fills the page width; keep the short verse fixture above for layout tests.
export const readerStoryContentVersion = 'reader-story-2'

export const readerStoryParagraphs = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse lectus tortor, dignissim sit amet, adipiscing nec, ultricies sed, dolor. Cras elementum ultrices diam. Maecenas ligula massa, varius a, semper congue, euismod non, mi. Proin porttitor, orci nec nonummy molestie, enim est eleifend mi, non fermentum diam nisl sit amet erat. Duis semper. Duis arcu massa, scelerisque vitae, consequat in, pretium a, enim. Pellentesque congue. Ut in risus volutpat libero pharetra tempor. Cras vestibulum bibendum augue.',
  'Praesent egestas leo in pede. Praesent blandit odio eu enim. Pellentesque sed dui ut augue blandit sodales. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae. Aliquam nibh. Mauris ac mauris sed pede pellentesque fermentum. Maecenas adipiscing ante non diam sodales hendrerit. Ut velit mauris, egestas sed, gravida nec, ornare ut, mi. Aenean ut orci vel massa suscipit pulvinar. Nulla sollicitudin. Fusce varius, ligula non tempus aliquam, nunc turpis ullamcorper nibh, in tempus sapien eros vitae ligula.',
  'Donec nec justo eget felis facilisis fermentum. Aliquam porttitor mauris sit amet orci. Aenean dignissim pellentesque felis. Morbi in sem quis dui placerat ornare. Pellentesque odio nisi, euismod in, pharetra a, ultricies in, diam. Sed arcu. Cras consequat. Nulla facilisi. Aenean nec eros. Vestibulum erat wisi, condimentum sed, commodo vitae, ornare sit amet, wisi. Aenean fermentum, elit eget tincidunt condimentum, eros ipsum rutrum orci, sagittis tempus lacus enim ac dui. Donec non enim in turpis pulvinar facilisis.',
  'Ut felis. Praesent dapibus, neque id cursus faucibus, tortor neque egestas augue, eu vulputate magna eros eu erat. Aliquam erat volutpat. Nam dui mi, tincidunt quis, accumsan porttitor, facilisis luctus, metus. Phasellus ultrices nulla quis nibh. Quisque a lectus. Donec consectetuer ligula vulputate sem tristique cursus. Nam nulla quam, gravida non, commodo a, sodales sit amet, nisi. Pellentesque fermentum dolor. Aliquam quam lectus, facilisis auctor, ultrices ut, elementum vulputate, nunc. Sed adipiscing ornare risus. Morbi est est, blandit sit amet, sagittis vel, euismod vel, velit.',
]

const readerStoryParagraphsForPage = [
  ...readerStoryParagraphs,
  ...readerStoryParagraphs,
  ...readerStoryParagraphs,
]

export const readerStoryProseSegment: CachedSegment = {
  ...readerBookSegment,
  version: readerStoryContentVersion,
  source_key: 'reader-story-prose',
  kind: 'prose',
  html_content: readerStoryParagraphsForPage
    .map((paragraph) => `<p class="gap-after">${paragraph}</p>`)
    .join('\n'),
  text_content: readerStoryParagraphsForPage.join('\n'),
}
