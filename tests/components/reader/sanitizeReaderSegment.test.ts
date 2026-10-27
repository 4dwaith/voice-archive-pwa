// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { sanitizeReaderSegment } from '../../../src/components/atoms/ReaderSegmentContent/sanitizeReaderSegment'
import type { ReaderSegment } from '../../../src/models/reader'

function createSegment(html: string, text = 'x'): ReaderSegment {
  return {
    id: 1,
    source_key: 'test',
    kind: 'prose',
    html_content: html,
    text_content: text,
    language: null,
  }
}

describe('reader sanitization boundary', () => {
  it('projects supported blocks, nested emphasis and breaks without changing the source', () => {
    const segment = createSegment(
      '<p>A <strong>bold <em>and italic</em></strong><br>end</p>',
      'A bold and italic\nend',
    )
    const original = structuredClone(segment)

    const result = sanitizeReaderSegment(segment)

    expect(result).toEqual({
      isValid: true,
      nodes: [
        {
          tag: 'p',
          className: '',
          children: [
            'A ',
            {
              tag: 'strong',
              className: '',
              children: [
                'bold ',
                { tag: 'em', className: '', children: ['and italic'] },
              ],
            },
            { tag: 'br', className: '', children: [] },
            'end',
          ],
        },
      ],
    })
    expect(segment).toEqual(original)
  })

  it('preserves a semantic heading and its imported formatting class', () => {
    const segment = {
      ...createSegment('<h6 class="align-left">x</h6>'),
      kind: 'heading' as const,
    }

    const result = sanitizeReaderSegment(segment)

    expect(result).toEqual({
      isValid: true,
      nodes: [
        { tag: 'h6', className: 'reader-import-align-left', children: ['x'] },
      ],
    })
  })

  it('projects decoded entities, Unicode and whitespace exactly, including literal escaped markup', () => {
    const text = '  ಕನ್ನಡ é 😀 <script>\n\t '
    const segment = createSegment(
      '<p>  ಕನ್ನಡ&nbsp;e&#x301; &#x1F600; &lt;script&gt;\n\t </p>',
      text,
    )

    const result = sanitizeReaderSegment(segment)

    expect(result).toEqual({
      isValid: true,
      nodes: [{ tag: 'p', className: '', children: [text] }],
    })
  })

  it('namespaces app collisions and unknown classes, splitting tokens on HTML whitespace', () => {
    const segment = createSegment(
      '<p class="hidden\tfuture-style\nreader-segment-error">x</p>',
    )

    const result = sanitizeReaderSegment(segment)

    expect(result).toEqual({
      isValid: true,
      nodes: [
        {
          tag: 'p',
          className:
            'reader-import-hidden reader-import-future-style reader-import-reader-segment-error',
          children: ['x'],
        },
      ],
    })
  })

  // Check our class-only policy, especially attribute families that require
  // explicit configuration, rather than maintaining an exhaustive payload list.
  it.each([
    { rule: 'event-handler', html: '<p onclick="alert(1)">x</p>' },
    { rule: 'style', html: '<p style="display:none">x</p>' },
    { rule: 'ARIA', html: '<p aria-hidden="true">x</p>' },
    { rule: 'data', html: '<p data-reader-selected="true">x</p>' },
  ])('rejects imported $rule attributes', ({ html }) => {
    const segment = createSegment(html)

    const result = sanitizeReaderSegment(segment)

    expect(result).toEqual({ isValid: false, error: 'unsupported-markup' })
  })

  it.each([
    { rule: 'script', html: '<p><script>alert(1)</script>x</p>' },
    {
      rule: 'external resource',
      html: '<p><img src="https://example.invalid/image" alt="">x</p>',
    },
    { rule: 'unsupported harmless tag', html: '<p><span>x</span></p>' },
  ])(
    'rejects the whole segment for a $rule instead of silently stripping it',
    ({ html }) => {
      const segment = createSegment(html)

      const result = sanitizeReaderSegment(segment)

      expect(result).toEqual({ isValid: false, error: 'unsupported-markup' })
    },
  )

  it('excludes non-HTML namespaces from the rendering policy', () => {
    const segment = createSegment('<svg><text>x</text></svg>')

    const result = sanitizeReaderSegment(segment)

    expect(result).toEqual({ isValid: false, error: 'unsupported-markup' })
  })

  it('inspects attributes on document wrappers that fragment parsing would discard', () => {
    const segment = createSegment(
      '<html onclick="alert(1)" lang="en-US"><body><p>x</p></body></html>',
    )

    const result = sanitizeReaderSegment(segment)

    expect(result).toEqual({ isValid: false, error: 'unsupported-markup' })
  })

  it('rejects a canonical-text mismatch, including a missing LF for br', () => {
    const segment = createSegment('<p>x<br>y</p>', 'xy')

    const result = sanitizeReaderSegment(segment)

    expect(result).toEqual({ isValid: false, error: 'text-mismatch' })
  })

  it('rejects an unsupported segment kind at runtime', () => {
    const segment = createSegment('<p>x</p>')
    Object.assign(segment, { kind: 'image' })

    const result = sanitizeReaderSegment(segment)

    expect(result).toEqual({ isValid: false, error: 'unsupported-kind' })
  })
})
