/**
 * Setup check: proves the configured exchange endpoint is reachable and that
 * the credentials/signature path works, without placing an order.
 *
 *   npm run check          # any mode (mock is valid for development)
 *   npm run check:live     # must be a real testnet account with a position
 *
 * Never prints secrets.
 */
import 'dotenv/config'
import { config } from '../server/config.ts'
import { createAdapter } from '../server/exchange/index.ts'

const requireLive = process.argv.includes('--require-live')
const adapter = createAdapter()

console.log(`mode:   ${adapter.mode}`)
console.log(`symbol: ${config.symbol}`)

if (requireLive && adapter.mode === 'mock') {
  console.error('')
  console.error('FAILED — the API is on the mock adapter, so no testnet account is connected.')
  console.error('Add testnet keys to .env:')
  console.error('  EXCHANGE=auto            (or binance)')
  console.error('  BINANCE_API_KEY=...      (testnet, from testnet.binancefuture.com)')
  console.error('  BINANCE_API_SECRET=...')
  console.error('Then run `npm run check:live` again.')
  process.exit(1)
}

try {
  const position = await adapter.getPosition(config.symbol)
  console.log(`mark:   ${position.markPrice.toFixed(2)}`)
  console.log(`position: ${position.hasPosition ? `${position.side} ${position.qty}` : 'flat'}`)
  if (position.hasPosition) {
    console.log(`entry:  ${position.entryPrice}`)
    console.log(`liq:    ${position.liqPrice ?? 'n/a'}`)
    console.log(`pnl:    ${position.unrealizedPnl.toFixed(2)} USDT (${position.roePct.toFixed(1)}% ROE)`)
  }

  if (requireLive && !position.hasPosition) {
    console.error('')
    console.error('FAILED — connected, but there is no open position to guard.')
    console.error(`Open one on testnet (${config.symbol} long 0.01, 20x), then re-run.`)
    process.exit(1)
  }

  if (adapter.mode === 'mock') {
    console.log('OK — mock adapter, no network calls. Use `npm run check:live` for testnet.')
  } else {
    console.log('OK — testnet endpoint reachable and signed request accepted.')
  }
} catch (err) {
  const message = (err as Error).message
  console.error(`FAILED — ${message}`)
  if (/banned|too many|rate.?limit/i.test(message)) {
    console.error('Binance is rate-limiting this IP. Wait for the ban window to end, then retry.')
  } else if (config.exchange === 'binance' && !config.hasBinanceKeys) {
    console.error('Add BINANCE_API_KEY / BINANCE_API_SECRET to .env (testnet keys).')
  }
  process.exitCode = 1
}
