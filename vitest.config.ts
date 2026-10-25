import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    root: '.',
    include: ['test/**/*.test.ts'],
    // Command tests spawn the built CLI; under parallel load a spawn can pass 5 s.
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
    },
  },
})
