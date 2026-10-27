import { useId, useLayoutEffect, useRef } from 'react'
import { useReaderContext } from '../../../contexts/ReaderContext'
import type { ReaderSection } from '../../../models/reader'
import styles from './ReaderTableOfContents.module.css'

function ReaderSectionList({
  childrenByParent,
  parentId,
  isHidden = false,
}: {
  childrenByParent: Map<number | null, ReaderSection[]>
  parentId: number | null
  isHidden?: boolean
}) {
  const {
    selectedSectionId,
    isSectionExpanded,
    selectSection,
    setSectionExpanded,
  } = useReaderContext()

  return (
    <ul hidden={isHidden}>
      {(childrenByParent.get(parentId) ?? []).map((section) => {
        const hasChildren = childrenByParent.has(section.id)
        const isExpanded = isSectionExpanded(section.id)

        return (
          <li key={section.id}>
            <button
              type="button"
              className={styles.section}
              aria-current={
                selectedSectionId === section.id ? 'true' : undefined
              }
              onClick={() => selectSection(section.id)}
            >
              {section.title}
            </button>
            {hasChildren && (
              <details open={isExpanded}>
                <summary
                  aria-label={`Subsections of ${section.title}`}
                  aria-expanded={isExpanded}
                  onClick={(event) => {
                    event.preventDefault()
                    setSectionExpanded({
                      sectionId: section.id,
                      isExpanded: !isExpanded,
                    })
                  }}
                />
                <ReaderSectionList
                  childrenByParent={childrenByParent}
                  parentId={section.id}
                  isHidden={!isExpanded}
                />
              </details>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function ReaderTableOfContents({
  sections,
}: {
  sections: ReaderSection[]
}) {
  const { isSectionExpanded, tocPresentation, setTocPresentation } =
    useReaderContext()

  const navRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const bodyId = useId()
  const isCollapsed = tocPresentation === 'collapsed'
  const childrenByParent = new Map<number | null, ReaderSection[]>()
  const sortedSections = [...sections].sort((a, b) => a.sequence - b.sequence)

  for (const section of sortedSections) {
    const siblings = childrenByParent.get(section.parent_id) ?? []
    siblings.push(section)
    childrenByParent.set(section.parent_id, siblings)
  }

  useLayoutEffect(() => {
    const nav = navRef.current
    const active = nav?.ownerDocument.activeElement
    if (!active || !nav?.contains(active)) return

    if (isCollapsed) {
      toggleRef.current?.focus()
      return
    }

    // Also recover focus when an external context action closes an ancestor.
    const closedBranch = [...nav.querySelectorAll('details:not([open])')].find(
      (branch) => branch.contains(active),
    )

    closedBranch?.querySelector('summary')?.focus()
  }, [isCollapsed, isSectionExpanded])

  return (
    <nav
      ref={navRef}
      aria-label="Table of contents"
      className={styles.toc}
      data-presentation={tocPresentation}
    >
      <button
        ref={toggleRef}
        type="button"
        aria-controls={bodyId}
        aria-expanded={!isCollapsed}
        aria-label={
          isCollapsed ? 'Show table of contents' : 'Collapse table of contents'
        }
        onClick={() => setTocPresentation(isCollapsed ? 'shown' : 'collapsed')}
      >
        <span aria-hidden="true">☰</span>
        {!isCollapsed && ' Table of contents'}
      </button>
      <div id={bodyId} hidden={isCollapsed} className={styles.body}>
        {sections.length ? (
          <ReaderSectionList
            childrenByParent={childrenByParent}
            parentId={null}
          />
        ) : (
          <p>No sections available.</p>
        )}
      </div>
    </nav>
  )
}
