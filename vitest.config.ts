import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/__tests__/**/*.spec.ts'],
      setupFiles: ['./src/test/setup.ts'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      // BUG-028: specs que montam views inteiras com Vuetify passam de 5s sob carga.
      testTimeout: 15000,
      server: {
        deps: {
          inline: ['vuetify'],
        },
      },
    },
  }),
)
