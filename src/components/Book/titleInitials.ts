export function titleInitials(title: string) {
  const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return title
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map(
      (word) =>
        graphemes.segment(word)[Symbol.iterator]().next().value?.segment ?? '',
    )
    .join('')
    .toLocaleUpperCase()
}
