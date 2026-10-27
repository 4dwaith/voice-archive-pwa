export function resolvePageNumber(
  requestedPage: number,
  pageCount: number | null,
): number | null {
  if (
    pageCount === null ||
    pageCount === 0 ||
    !Number.isSafeInteger(requestedPage)
  )
    return null

  return Math.max(1, Math.min(requestedPage, pageCount))
}

export function resolvePageNumberFromFraction(
  fraction: number,
  pageCount: number,
): number | null {
  return resolvePageNumber(Math.floor(fraction * pageCount) + 1, pageCount)
}
