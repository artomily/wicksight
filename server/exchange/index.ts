import { config } from '../config.ts'
import type { ExchangeAdapter } from './types.ts'
import { BinanceTestnetAdapter } from './binance.ts'
import { OkxDemoAdapter } from './okx.ts'
import { MockAdapter } from './mock.ts'

export function createAdapter(): ExchangeAdapter {
  switch (config.exchange) {
    case 'binance':
      return new BinanceTestnetAdapter(config.binance.apiKey, config.binance.apiSecret, config.binance.baseUrl)
    case 'okx':
      return new OkxDemoAdapter(
        config.okx.apiKey,
        config.okx.apiSecret,
        config.okx.passphrase,
        config.okx.baseUrl,
      )
    case 'mock':
      return new MockAdapter()
    default:
      throw new Error(`Unsupported exchange: ${config.exchange}`)
  }
}
