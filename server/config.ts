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
  symbol: str('SYMBOL', 'BTCUSDT').toUpperCase(),
  exchange,
  asrProvider: (str('ASR_PROVIDER', 'local').toLowerCase() as AsrProvider),
  warmAsr: str('WARM_ASR', '1') !== '0',
  binance: {
    baseUrl: str('BINANCE_FUTURES_BASE', 'https://testnet.binancefuture.com'),
    apiKey: str('BINANCE_API_KEY'),
    apiSecret: str('BINANCE_API_SECRET'),
  },
  okx: {
    baseUrl: str('OKX_BASE_URL', 'https://www.okx.com'),
    apiKey: str('OKX_API_KEY'),
    apiSecret: str('OKX_API_SECRET'),
    passphrase: str('OKX_PASSPHRASE'),
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
 * Session Guard refuses to boot against a production exchange host.
 */
export function assertNonProductionHost(url: string, allowedTestnetHints: string[]) {
  const lowered = url.toLowerCase()
  const looksTestnet = allowedTestnetHints.some((hint) => lowered.includes(hint))
  if (!looksTestnet) {
    throw new Error(
      `Refusing to use "${url}". Session Guard only talks to testnet/demo endpoints (expected one of: ${allowedTestnetHints.join(', ')}).`,
    )
  }
}
