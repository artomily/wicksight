export function fmtPrice(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function fmtQty(value: number, decimals = 3): string {
  if (!Number.isFinite(value)) return '—'
  const fixed = value.toFixed(decimals)
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
}

export function fmtSigned(value: number, decimals = 2): string {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${Math.abs(value).toFixed(decimals)}`
}

export function fmtPct(value: number, decimals = 1): string {
  return `${fmtSigned(value, decimals)}%`
}

export function modeLabel(mode: string): string {
  switch (mode) {
    case 'binance-testnet':
      return 'BINANCE TESTNET'
    case 'okx-demo':
      return 'OKX DEMO'
    case 'mock':
      return 'MOCK DATA'
    default:
      return mode.toUpperCase()
  }
}

export function compact(message: string, max = 88): string {
  const clean = message.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

export function ellipsis(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
