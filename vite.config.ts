import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // The order routes require this token; the WebView gets the same value the
  // server reads from .env. It is a local shared secret, not a substitute for
  // real auth on a public deployment.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    define: {
      __SG_API_TOKEN__: JSON.stringify(env.API_TOKEN || 'dev-local-token'),
    },
  }
})
