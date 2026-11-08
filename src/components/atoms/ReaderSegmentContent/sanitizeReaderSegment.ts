import createDOMPurify from 'dompurify'
import type { ReaderSegment, ReaderSegmentError } from '../../../models/reader'

const allowedTags = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'em',
  'br',
] as const
type ReaderHtmlTag = (typeof allowedTags)[number]
export type ReaderContentNode =
  | string
  | { tag: ReaderHtmlTag; className: string; children: ReaderContentNode[] }
export type SanitizedReaderSegment =
  | { isValid: true; nodes: ReaderContentNode[] }
  | { isValid: false; error: ReaderSegmentError }

function isReaderHtmlTag(tag: string): tag is ReaderHtmlTag {
  return allowedTags.some((allowed) => allowed === tag)
}

function projectSafeNodes(parent: Node): ReaderContentNode[] {
  return Array.from(parent.childNodes).flatMap((node): ReaderContentNode[] => {
    if (node.nodeType === Node.TEXT_NODE) return [node.textContent ?? '']
    if (!(node instanceof Element) || !isReaderHtmlTag(node.localName))
      return []
    return [
      {
        tag: node.localName,
        className: Array.from(
          node.classList,
          (token) => `reader-import-${token}`,
        ).join(' '),
        children: projectSafeNodes(node),
      },
    ]
  })
}

function deriveCanonicalText(nodes: ReaderContentNode[]): string {
  return nodes
    .map((node) =>
      typeof node === 'string'
        ? node
        : node.tag === 'br'
          ? '\n'
          : deriveCanonicalText(node.children),
    )
    .join('')
}

export function sanitizeReaderSegment(
  segment: ReaderSegment,
): SanitizedReaderSegment {
  if (!['heading', 'prose', 'verse'].includes(segment.kind)) {
    return { isValid: false, error: 'unsupported-kind' }
  }
  try {
    // A private instance keeps hooks/configuration isolated from other consumers.
    // DOMPurify parses in a detached document; raw HTML never enters the live DOM.
    const purifier = createDOMPurify(window)
    if (!purifier.isSupported)
      return { isValid: false, error: 'sanitizer-unavailable' }
    let hasUnsupportedMarkup = false
    purifier.addHook('uponSanitizeElement', (node, data) => {
      // The HTML parser creates these document containers even for fragments.
      if (
        !['html', 'head', 'body'].includes(data.tagName) &&
        !isReaderHtmlTag(data.tagName) &&
        node.nodeType !== Node.TEXT_NODE
      ) {
        hasUnsupportedMarkup = true
      }
      if (
        node instanceof Element &&
        node.namespaceURI !== 'http://www.w3.org/1999/xhtml'
      ) {
        hasUnsupportedMarkup = true
      }
    })
    purifier.addHook('uponSanitizeAttribute', (_node, data) => {
      if (data.attrName !== 'class') hasUnsupportedMarkup = true
    })
    // Rejection reporting never substitutes for sanitization. Explicitly disable
    // DOMPurify's otherwise permitted data/ARIA attributes and non-HTML namespaces.
    const fragment = purifier.sanitize(segment.html_content, {
      ALLOWED_TAGS: [...allowedTags, 'html', 'head', 'body'],
      ALLOWED_ATTR: ['class'],
      ALLOW_ARIA_ATTR: false,
      ALLOW_DATA_ATTR: false,
      ALLOWED_NAMESPACES: ['http://www.w3.org/1999/xhtml'],
      RETURN_DOM_FRAGMENT: true,
      // Inspect attributes on document wrappers too, before extracting body text.
      WHOLE_DOCUMENT: true,
    })
    if (hasUnsupportedMarkup)
      return { isValid: false, error: 'unsupported-markup' }
    const body = fragment.querySelector('body')
    if (!body) return { isValid: false, error: 'unsupported-markup' }
    const nodes = projectSafeNodes(body)
    if (deriveCanonicalText(nodes) !== segment.text_content) {
      return { isValid: false, error: 'text-mismatch' }
    }
    return { isValid: true, nodes }
  } catch (error) {
    console.warn('Reader content sanitization failed.', error)
    return { isValid: false, error: 'sanitizer-unavailable' }
  }
}
