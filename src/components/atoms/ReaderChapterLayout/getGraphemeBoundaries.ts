// DOM Range uses UTF-16; canonical text offsets count unchanged Unicode code points.
export function getGraphemeBoundaries(text: string) {
  const boundaries = [{ utf16: 0, codePoint: 0 }]
  let codePoint = 0
  for (const { index, segment } of new Intl.Segmenter(undefined, {
    granularity: 'grapheme',
  }).segment(text)) {
    codePoint += Array.from(segment).length
    boundaries.push({ utf16: index + segment.length, codePoint })
  }
  return boundaries
}
