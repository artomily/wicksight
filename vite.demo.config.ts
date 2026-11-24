import { defineConfig } from 'vite'
import { resolve } from 'node:path'

/**
 * Static demo build for Vercel. It bundles only `demo.html` + `src/demo.ts`
 * (local mock state, no server, no API token, no exchange calls), so the
 * public deployment cannot reach the order path.
 */
export default defineConfig({
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        demo: resolve(process.cwd(), 'demo.html'),
      },
    },
  },
})
