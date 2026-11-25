/**
 * Risk ordering shared by the server, the glasses HUD, and the browser
 * simulator. "Riskiest" means: any position with a live time-to-liquidation
 * comes first, shortest ETA first; the rest follow by smallest buffer to the
 * liquidation line. Flat positions and positions without a liq price go last.
 */
export interface RiskInput {
  symbol: string
  hasPosition: boolean
  distanceToLiqPct: number | null
}

export interface RiskEta {
  minutes: number
}

export interface RiskItem<P extends RiskInput = RiskInput, E extends RiskEta = RiskEta> {
  position: P
  eta: E | null
}

function bucket(item: RiskItem): number {
  if (!item.position.hasPosition) return 3
  if (item.eta) return 0
  if (item.position.distanceToLiqPct !== null) return 1
  return 2
}

export function compareRisk(a: RiskItem, b: RiskItem): number {
  const ba = bucket(a)
  const bb = bucket(b)
  if (ba !== bb) return ba - bb
  if (ba === 0) {
    const d = a.eta!.minutes - b.eta!.minutes
    if (d !== 0) return d
  }
  const da = a.position.distanceToLiqPct ?? Number.POSITIVE_INFINITY
  const db = b.position.distanceToLiqPct ?? Number.POSITIVE_INFINITY
  if (da !== db) return da - db
  return a.position.symbol.localeCompare(b.position.symbol)
}

/** Stable copy sorted riskiest first. */
export function rankByRisk<T extends RiskItem>(items: readonly T[]): T[] {
  return [...items].sort(compareRisk)
}

/** "BTCUSDT" -> "BTC" for the cramped HUD header. */
export function baseAsset(symbol: string): string {
  return symbol.replace(/(USDT|USDC|BUSD|USD)$/i, '') || symbol
}

function etaShort(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 1) return '<1m'
  if (minutes < 60) return `~${Math.round(minutes)}m`
  return `~${(minutes / 60).toFixed(1)}h`
}

/**
 * Header for the multi-position HUD, e.g. "3 positions · riskiest SOL ~6m".
 * `ranked` must already be sorted with {@link rankByRisk}.
 */
export function riskHeader(ranked: readonly RiskItem[]): string {
  const open = ranked.filter((item) => item.position.hasPosition)
  if (open.length === 0) return 'No open positions'
  const top = open[0]
  const label = baseAsset(top.position.symbol)
  const detail = top.eta
    ? etaShort(top.eta.minutes)
    : top.position.distanceToLiqPct !== null
      ? `${top.position.distanceToLiqPct.toFixed(1)}%`
      : ''
  const count = open.length === 1 ? '1 position' : `${open.length} positions`
  return `${count} · riskiest ${label}${detail ? ` ${detail}` : ''}`
}
