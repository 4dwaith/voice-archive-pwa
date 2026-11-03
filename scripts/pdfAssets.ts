import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { normalizePath } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export function createPdfAssetsPlugin() {
  const require = createRequire(import.meta.url)
  const directory = dirname(require.resolve('pdfjs-dist/package.json'))
  return [
    {
      name: 'reader-pdf-compatibility',
      config: () => ({
        resolve: {
          // React-PDF and the worker must both use PDF.js's compatibility build.
          alias: [
            {
              find: /^pdfjs-dist$/,
              replacement: join(directory, 'legacy/build/pdf.mjs'),
            },
          ],
        },
      }),
    },
    ...viteStaticCopy({
      targets: ['cmaps', 'standard_fonts', 'wasm', 'iccs'].map((name) => ({
        src: normalizePath(join(directory, name, '*')),
        dest: `pdfjs/${name}`,
        rename: { stripBase: true },
      })),
    }),
  ]
}
