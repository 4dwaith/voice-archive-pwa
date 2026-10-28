import type { StorybookConfig } from '@storybook/react-vite'

function isPwaPlugin(plugin: unknown) {
  return (
    typeof plugin === 'object' &&
    plugin !== null &&
    'name' in plugin &&
    typeof plugin.name === 'string' &&
    plugin.name.startsWith('vite-plugin-pwa')
  )
}

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: '@storybook/react-vite',
  staticDirs: ['../public'],
  viteFinal: async (viteConfig) => {
    // Both dev and build use the same isolated, persistent Storybook storage.
    viteConfig.define = {
      ...viteConfig.define,
      'import.meta.env.VITE_READER_PREFERENCES_KEY': JSON.stringify(
        process.env.VITE_READER_PREFERENCES_KEY ||
          'voice-archive-reader-storybook',
      ),
      'import.meta.env.VITE_DATABASE_NAME': JSON.stringify(
        process.env.VITE_DATABASE_NAME || 'voice-archive-storybook',
      ),
    }

    // Keep the renderer and story hooks on the same React instance, and
    // prebundle their entry points together before the first story is opened.
    viteConfig.resolve = {
      ...viteConfig.resolve,
      dedupe: [
        ...new Set([
          ...(viteConfig.resolve?.dedupe ?? []),
          'react',
          'react-dom',
        ]),
      ],
    }

    viteConfig.optimizeDeps = {
      ...viteConfig.optimizeDeps,
      include: [
        ...new Set([
          ...(viteConfig.optimizeDeps?.include ?? []),
          'react',
          'react-dom',
          'react-dom/client',
          'react/jsx-runtime',
          'react/jsx-dev-runtime',
        ]),
      ],
    }

    // The IDE opens Chrome with --no-open, so Vite's usual browser-open
    // prewarming never happens. Prepare story modules on server startup too.
    viteConfig.server = {
      ...viteConfig.server,
      warmup: {
        ...viteConfig.server?.warmup,
        clientFiles: [
          ...(viteConfig.server?.warmup?.clientFiles ?? []),
          './src/components/**/*.stories.tsx',
        ],
      },
    }

    viteConfig.plugins = viteConfig.plugins
      ?.flat()
      .filter((plugin) => !isPwaPlugin(plugin))

    return viteConfig
  },
}

export default config
