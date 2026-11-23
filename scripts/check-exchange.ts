/**
 * Setup check: proves the configured exchange endpoint is reachable and that
 * the credentials/signature path works, without placing an order.
 *
 *   npm run check
 *
 * With no keys it checks the mock adapter. With testnet keys it reads the
 * position once. Never prints secrets.
 */
import 'dotenv/config'
import { config } from '../server/config.ts'
import { createAdapter } from '../server/exchange/index.ts'

const adapter = createAdapter()
console.log(`mode:   ${adapter.mode}`)
console.log(`symbol: ${config.symbol}`)

try {
  const position = await adapter.getPosition(config.symbol)
  console.log(`mark:   ${position.markPrice.toFixed(2)}`)
  console.log(`position: ${position.hasPosition ? `${position.side} ${position.qty}` : 'flat'}`)
  if (position.hasPosition) {
    console.log(`entry:  ${position.entryPrice}`)
    console.log(`liq:    ${position.liqPrice ?? 'n/a'}`)
    console.log(`pnl:    ${position.unrealizedPnl.toFixed(2)} USDT (${position.roePct.toFixed(1)}% ROE)`)
  }
  console.log(
    config.exchange === 'mock'
      ? 'OK — mock adapter, no network calls.'
      : 'OK — endpoint reachable and signed request accepted.',
  )
} catch (err) {
  const message = (err as Error).message
  console.error(`FAILED — ${message}`)
  if (config.exchange === 'binance' && !config.hasBinanceKeys) {
    console.error('Add BINANCE_API_KEY / BINANCE_API_SECRET to .env (testnet keys).')
  }
  process.exitCode = 1
}
