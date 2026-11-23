export type VoiceIntent =
  | { type: 'alert'; price: number }
  | { type: 'close_half' }
  | { type: 'cancel_alert' }
  | { type: 'none'; reason: string; hint: string }

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
}

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
}

/** "sixty two thousand five hundred" -> 62500 */
export function spokenNumberToDigits(input: string): number | null {
  const tokens = input.toLowerCase().replace(/-/g, ' ').split(/[^a-z]+/).filter(Boolean)
  let total = 0
  let current = 0
  let seen = false

  for (const token of tokens) {
    if (token in ONES) {
      current += ONES[token]
      seen = true
    } else if (token in TENS) {
      current += TENS[token]
      seen = true
    } else if (token === 'hundred') {
      current = (current || 1) * 100
      seen = true
    } else if (token === 'thousand' || token === 'k') {
      total += (current || 1) * 1_000
      current = 0
      seen = true
    } else if (token === 'million' || token === 'm') {
      total += (current || 1) * 1_000_000
      current = 0
      seen = true
    }
  }

  if (!seen) return null
  return total + current
}

export function extractPrice(text: string): number | null {
  const cleaned = text
    .toLowerCase()
    .replace(/usdt|usd|dollars?|bucks?/g, ' ')
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/(\d)_(?=\d{3}\b)/g, '$1')
    .replace(/(\d)\s(?=\d{3}\b)/g, '$1')

  const digitMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(k|m|thousand|million)?\b/)
  if (digitMatch) {
    const base = Number(digitMatch[1])
    if (!Number.isFinite(base)) return null
    const suffix = digitMatch[2]
    if (suffix === 'k' || suffix === 'thousand') return base * 1_000
    if (suffix === 'm' || suffix === 'million') return base * 1_000_000
    return base
  }

  if (/\b(one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)\b/.test(cleaned)) {
    return spokenNumberToDigits(cleaned)
  }

  return null
}

const ALERT_VERBS = /\b(alert|alarm|warn|notify|ping|tell me|let me know)\b/
const CANCEL_VERBS = /\b(cancel|clear|remove|delete|stop)\b/
const CLOSE_VERBS = /\b(close|cut|reduce|take|trim|exit|get out)\b/
const HALF_WORDS = /\b(half|fifty percent|50 percent|50%)\b/

export function parseIntent(text: string, markPrice?: number): VoiceIntent {
  const normalized = ` ${text.toLowerCase().replace(/[^a-z0-9.,%$\s]+/g, ' ')} `

  if (CANCEL_VERBS.test(normalized) && ALERT_VERBS.test(normalized)) {
    return { type: 'cancel_alert' }
  }

  if (CLOSE_VERBS.test(normalized) || /\bclose\b/.test(normalized)) {
    if (HALF_WORDS.test(normalized)) return { type: 'close_half' }
    if (/\b(all|everything|entire|full)\b/.test(normalized)) {
      return {
        type: 'none',
        reason: 'close_all_unsupported',
        hint: 'Only "close half" is enabled.',
      }
    }
  }

  if (ALERT_VERBS.test(normalized)) {
    const price = extractPrice(normalized)
    if (price === null) {
      return { type: 'none', reason: 'no_price', hint: 'Try: "alert 62,000"' }
    }
    if (markPrice && (price < markPrice * 0.2 || price > markPrice * 5)) {
      return {
        type: 'none',
        reason: 'price_out_of_range',
        hint: 'That price is too far from the market.',
      }
    }
    return { type: 'alert', price }
  }

  return {
    type: 'none',
    reason: 'unrecognized',
    hint: 'Try "alert 62,000" or "close half".',
  }
}
