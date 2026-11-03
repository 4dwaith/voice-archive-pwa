export function resolveNarrationOffset(text: string, progress: number) {
  const length = Array.from(text).length
  return Math.min(
    Math.max(0, length - 1),
    Math.floor(Math.max(0, Math.min(1, progress)) * length),
  )
}

export function scrollNarrationToProgress(
  container: HTMLElement,
  text: HTMLElement,
  progress: number,
  canonicalText: string,
) {
  let remaining = resolveNarrationOffset(canonicalText, progress)
  let position: { node: Node; start: number; end: number } | undefined
  function findTextPosition(node: Node) {
    if (position) return
    if (node.nodeType === Node.TEXT_NODE) {
      const characters = Array.from(node.textContent ?? '')
      if (remaining < characters.length) {
        const start = characters.slice(0, remaining).join('').length
        position = { node, start, end: start + characters[remaining].length }
      } else remaining -= characters.length
    } else if (node.nodeName === 'BR') remaining = Math.max(0, remaining - 1)
    else node.childNodes.forEach(findTextPosition)
  }
  findTextPosition(text)
  if (!position) return
  const range = text.ownerDocument.createRange()
  range.setStart(position.node, position.start)
  range.setEnd(position.node, position.end)
  const line = range.getBoundingClientRect()
  const viewport = container.getBoundingClientRect()
  if (progress === 0) container.scrollTop = 0
  else if (
    line.top < viewport.top ||
    line.bottom > viewport.top + container.clientHeight * 0.75
  )
    container.scrollTop +=
      line.top - viewport.top - container.clientHeight * 0.25
}
