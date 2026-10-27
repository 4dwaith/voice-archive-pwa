import { useId, useLayoutEffect, useRef } from 'react'
import { useReaderContext } from '../../../contexts/ReaderContext'
import type { ReaderSection } from '../../../models/reader'

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
  } = useReaderContext().toc

  return (
    <ul hidden={isHidden} className="m-0 list-none p-0">
      {(childrenByParent.get(parentId) ?? []).map((section) => {
        const hasChildren = childrenByParent.has(section.id)
        const isExpanded = isSectionExpanded(section.id)

        return (
          <li key={section.id} className="relative">
            <button
              type="button"
              className="ms-8 block min-h-11 w-[calc(100%-2rem)] cursor-pointer p-2 text-start wrap-anywhere aria-current:bg-[#dbeafe] aria-current:font-bold! focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1d4ed8]"
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
                  className="absolute inset-s-0 top-0 min-h-11 w-8 cursor-pointer p-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1d4ed8]"
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
    useReaderContext().toc

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
      className="flex max-h-full min-w-0 flex-col bg-white text-[#172033] data-[presentation=dimmed]:focus-within:opacity-100 [&_ul_ul]:ps-3"
      data-presentation={tocPresentation}
    >
      <button
        ref={toggleRef}
        type="button"
        className="min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1d4ed8]"
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
      <div id={bodyId} hidden={isCollapsed} className="min-h-0 overflow-auto">
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
