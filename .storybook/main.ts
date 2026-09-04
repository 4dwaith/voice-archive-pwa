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
    viteConfig.plugins = viteConfig.plugins
      ?.flat()
      .filter((plugin) => !isPwaPlugin(plugin))

    return viteConfig
  },
}

export default config
