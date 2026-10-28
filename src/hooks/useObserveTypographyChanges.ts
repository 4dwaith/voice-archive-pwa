import {
  useEffectEvent,
  useLayoutEffect,
  useState,
  type RefObject,
} from 'react'
import { readTypography } from '../components/atoms/ReaderChapterLayout/layoutKey'

export function useObserveTypographyChanges(
  elementRef: RefObject<HTMLElement | null>,
  isEnabled: boolean,
  onInvalidate: () => void,
) {
  const [revision, setRevision] = useState(0)
  const invalidate = useEffectEvent(onInvalidate)

  useLayoutEffect(
    function observeTypographyChanges() {
      if (!isEnabled) return

      const element = elementRef.current!
      const document = element.ownerDocument
      const window = document.defaultView!
      const readTypographyIdentity = () =>
        JSON.stringify([
          readTypography(window.getComputedStyle(element)),
          window.devicePixelRatio,
        ])
      let typographyIdentity = readTypographyIdentity()

      const reportReadyTypography = () =>
        setRevision((previous) => previous + 1)
      const observeTypographyChange = () => {
        const nextIdentity = readTypographyIdentity()
        if (nextIdentity === typographyIdentity) return
        typographyIdentity = nextIdentity
        invalidate()
        reportReadyTypography()
      }

      const observer = new MutationObserver(observeTypographyChange)

      for (
        let ancestor = element.parentElement;
        ancestor;
        ancestor = ancestor.parentElement
      )
        observer.observe(ancestor, {
          attributes: true,
          attributeFilter: ['style', 'class', 'lang', 'dir'],
        })

      window.addEventListener('resize', observeTypographyChange)
      document.fonts.addEventListener('loading', invalidate)
      document.fonts.addEventListener('loadingdone', reportReadyTypography)
      document.fonts.addEventListener('loadingerror', reportReadyTypography)

      return () => {
        observer.disconnect()
        window.removeEventListener('resize', observeTypographyChange)
        document.fonts.removeEventListener('loading', invalidate)
        document.fonts.removeEventListener('loadingdone', reportReadyTypography)
        document.fonts.removeEventListener(
          'loadingerror',
          reportReadyTypography,
        )
      }
    },
    [elementRef, isEnabled],
  )

  return revision
}
