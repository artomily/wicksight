import type { OrderFill, PositionSnapshot, Side } from './exchange/types.ts'

export interface CloseReceipt {
  symbol: string
  side: Side
  closedQty: number
  avgPrice: number
  leftQty: number
  liqBefore: number | null
  liqAfter: number | null
  bufferBeforePct: number | null
  bufferAfterPct: number | null
}

const bufferOf = (position: PositionSnapshot): number | null => {
  if (position.distanceToLiqPct !== null) return position.distanceToLiqPct
  if (!position.liqPrice || position.liqPrice <= 0 || position.markPrice <= 0) return null
  return (Math.abs(position.markPrice - position.liqPrice) / position.markPrice) * 100
}

/**
 * The after-action receipt: what the close half did to the liquidation line.
 * `before` is the cached position immediately before the order; `after` is the
 * refreshed exchange position. Either liq price may be missing, in which case
 * the corresponding field is null and the HUD omits that half of the line.
 */
export function buildCloseReceipt(
  before: PositionSnapshot | null,
  after: PositionSnapshot,
  fill: OrderFill,
): CloseReceipt | null {
  if (!before || !before.hasPosition) return null

  return {
    symbol: after.symbol || before.symbol,
    side: before.side ?? fill.side,
    closedQty: fill.executedQty,
    avgPrice: fill.avgPrice,
    leftQty: after.qty,
    liqBefore: before.liqPrice && before.liqPrice > 0 ? before.liqPrice : null,
    liqAfter: after.liqPrice && after.liqPrice > 0 ? after.liqPrice : null,
    bufferBeforePct: bufferOf(before),
    bufferAfterPct: bufferOf(after),
  }
}
