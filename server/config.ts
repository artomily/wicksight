import 'dotenv/config'

export type ExchangeName = 'binance' | 'okx' | 'mock'
export type AsrProvider = 'local' | 'openai'

const env = process.env

function str(name: string, fallback = ''): string {
  return (env[name] ?? fallback).trim()
}

function resolveExchange(): ExchangeName {
  const raw = str('EXCHANGE', 'auto').toLowerCase()
  if (raw === 'binance' || raw === 'okx' || raw === 'mock') return raw
  if (raw !== 'auto') throw new Error(`Unknown EXCHANGE "${raw}" (use binance|okx|mock|auto)`)
  if (str('BINANCE_API_KEY') && str('BINANCE_API_SECRET')) return 'binance'
  if (str('OKX_API_KEY') && str('OKX_API_SECRET') && str('OKX_PASSPHRASE')) return 'okx'
  return 'mock'
}

const exchange = resolveExchange()

export const config = {
  port: Number(str('PORT', '8787')),
  // Loopback by default: a testnet order API should not be reachable from the LAN.
  host: str('HOST', '127.0.0.1'),
  symbol: str('SYMBOL', 'BTCUSDT').toUpperCase(),
  exchange,
  asrProvider: (str('ASR_PROVIDER', 'local').toLowerCase() as AsrProvider),
  asrModel: str('ASR_MODEL', 'onnx-community/whisper-small.en'),
  // Shared with the WebView (embedded by Vite) and required on order routes.
  apiToken: str('API_TOKEN', 'dev-local-token'),
  corsOrigins: str(
    'CORS_ORIGINS',
    'http://localhost:5173,http://127.0.0.1:5173,https://session-guard.fly.dev',
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  warmAsr: str('WARM_ASR', '1') !== '0',
  binance: {
    baseUrl: str('BINANCE_FUTURES_BASE', 'https://testnet.binancefuture.com'),
    wsBaseUrl: str('BINANCE_WS_BASE', 'wss://stream.binancefuture.com'),
    apiKey: str('BINANCE_API_KEY'),
    apiSecret: str('BINANCE_API_SECRET'),
  },
  okx: {
    baseUrl: str('OKX_BASE_URL', 'https://www.okx.com'),
    apiKey: str('OKX_API_KEY'),
    apiSecret: str('OKX_API_SECRET'),
    passphrase: str('OKX_PASSPHRASE'),
    // OKX demo is a request header, not a separate host; refuse to run without it.
    demo: str('OKX_DEMO', '1') !== '0',
  },
  openai: {
    apiKey: str('OPENAI_API_KEY'),
    sttModel: str('OPENAI_STT_MODEL', 'whisper-1'),
  },
  hasBinanceKeys: Boolean(str('BINANCE_API_KEY') && str('BINANCE_API_SECRET')),
  hasOkxKeys: Boolean(str('OKX_API_KEY') && str('OKX_API_SECRET') && str('OKX_PASSPHRASE')),
}

/**
 * Money-safety gate. Every adapter must pass its base URL through this.
 * Matching is by exact hostname — `testnet.binancefuture.com.evil.dev` must not
 * pass just because it contains the testnet host as a prefix.
 */
export function assertNonProductionHost(url: string, allowedHosts: string[]) {
  let hostname: string
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    throw new Error(`Refusing to use "${url}": not a valid URL.`)
  }
  if (!allowedHosts.includes(hostname)) {
    throw new Error(
      `Refusing to use "${url}". Session Guard only talks to testnet/demo endpoints (allowed hosts: ${allowedHosts.join(', ')}).`,
    )
  }
}
