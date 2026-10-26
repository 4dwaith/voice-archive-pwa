import type {
  CachedContent,
  CachedSection,
  CachedSegment,
} from '../models/content'

export function buildSectionHierarchyIndexes(
  sections: readonly CachedSection[],
) {
  const byId = new Map<number, CachedSection>()
  const roots = new Map<number, CachedSection>()

  // Reading sequence guarantees that each parent is indexed before its children.
  for (const section of sections) {
    const root =
      section.parent_id === null ? section : roots.get(section.parent_id)

    if (!root) throw new Error('Missing or out-of-order section ancestry')

    byId.set(section.id, section)
    roots.set(section.id, root)
  }

  return { byId, roots }
}

export function getSectionPath(
  sectionId: number | null,
  sections: readonly CachedSection[],
) {
  const { byId } = buildSectionHierarchyIndexes(sections)
  const path: CachedSection[] = []
  const seen = new Set<number>()
  let id = sectionId

  while (id !== null) {
    if (seen.has(id)) throw new Error('Cyclic section hierarchy')
    seen.add(id)

    const section = byId.get(id)
    if (!section) throw new Error('Missing section ancestry')

    path.push(section)
    id = section.parent_id
  }

  return path.reverse()
}

export function findRootSectionAudio(
  segment: CachedSegment,
  sections: readonly CachedSection[],
  content: CachedContent,
) {
  if (segment.section_id === null) return null

  const { roots } = buildSectionHierarchyIndexes(sections)
  const root = roots.get(segment.section_id)

  if (!root) throw new Error('Missing section ancestry')

  return (
    content.manifest.files.find(
      (file) => file.kind === 'audio_chapter' && file.section_id === root.id,
    ) ?? null
  )
}
