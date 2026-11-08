// Bump when fixed padding, column gap, imported formatting or font policy changes.
export const READER_LAYOUT_VERSION = '2'

export type ReaderLayoutDescriptor = {
  rendererVersion: string
  width: number
  height: number
  textSizePercent: number
  typography: string[]
  fontEnvironment: string
}

export async function createLayoutKey({
  rendererVersion,
  width,
  height,
  textSizePercent,
  typography,
  fontEnvironment,
}: ReaderLayoutDescriptor) {
  if (
    ![width, height, textSizePercent].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  )
    return null

  const bytes = new TextEncoder().encode(
    JSON.stringify([
      rendererVersion,
      width,
      height,
      textSizePercent,
      typography,
      fontEnvironment,
    ]),
  )
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

// Fixed, content-independent probes represent local fallback metrics, including
// the scripts currently used by the reader. This is not a portable font identity.
const FONT_PROBE = 'Hamburgefontsiv 0123456789 ಕಾ ಕನ್ನಡ क्षि हिन्दी é 😀'
const FONT_STYLES = ['normal 400', 'normal 700', 'italic 400', 'italic 700']

export async function readFontEnvironment(element: HTMLElement) {
  const document = element.ownerDocument
  const window = document.defaultView!
  const style = window.getComputedStyle(element)
  const fonts = FONT_STYLES.map(
    (variant) => `${variant} ${style.fontSize} ${style.fontFamily}`,
  )
  // Failed faces settle to CSS fallback; both failure status and actual fallback
  // metrics are represented. Never publish while the FontFaceSet is loading.
  await Promise.all(
    fonts.map((font) =>
      document.fonts.load(font, FONT_PROBE).catch((error) => {
        console.warn(
          'Reader font loading failed; using fallback metrics.',
          error,
        )
        return []
      }),
    ),
  )
  await document.fonts.ready

  const context = document.createElement('canvas').getContext('2d')!
  const metrics = fonts.map((font) => {
    context.font = font
    const measured = context.measureText(FONT_PROBE)
    return [
      measured.width,
      measured.actualBoundingBoxAscent,
      measured.actualBoundingBoxDescent,
    ]
  })
  const faces = Array.from(document.fonts, (face) =>
    JSON.stringify([
      face.family,
      face.style,
      face.weight,
      face.stretch,
      face.unicodeRange,
      face.status,
    ]),
  ).sort()
  return JSON.stringify([
    window.navigator.userAgent,
    window.devicePixelRatio,
    faces,
    metrics,
  ])
}

export function readTypography(style: CSSStyleDeclaration) {
  return [
    style.fontFamily,
    style.fontSize,
    style.fontWeight,
    style.fontStyle,
    style.fontStretch,
    style.fontFeatureSettings,
    style.fontVariationSettings,
    style.fontKerning,
    style.fontOpticalSizing,
    style.fontSynthesis,
    style.lineHeight,
    style.letterSpacing,
    style.wordSpacing,
    style.textRendering,
  ]
}
