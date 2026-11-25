import type { PageSpec } from '../ui.ts'
import { fmtPrice } from '../format.ts'
import type { CloseReceipt } from '../../server/receipt.ts'

const ESC: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}
const esc = (value: string): string => value.replace(/[&<>"']/g, (char) => ESC[char] ?? char)

const colorFor = (brightness: number): string =>
  brightness >= 4 ? '#00ff00' : brightness === 3 ? '#00e600' : brightness === 2 ? '#00c500' : '#008a00'

interface TextLike {
  xPosition: number
  yPosition: number
  width: number
  height: number
  borderWidth: number
  paddingLength: number
  containerName: string
  content: string
  textColor: number
  isEventCapture: number
}

/** Render the real Even Hub PageSpec in HTML. Used only by the browser simulator. */
export function pageHtml(spec: PageSpec): string {
  return spec.texts
    .map((text) => text as unknown as TextLike)
    .filter((text) => text.isEventCapture !== 1 && text.content.trim() !== '')
    .map((text) => {
      const color = colorFor(text.textColor)
      const base = [
        `left:${text.xPosition}px`,
        `top:${text.yPosition}px`,
        `color:${color}`,
      ].join(';')

      if (text.containerName === 'status') {
        return `<div class="hud-status-text" style="${base}">${esc(text.content)}</div>`
      }

      if (text.containerName === 'row-no' || text.containerName === 'row-yes') {
        const active = text.borderWidth > 0
        return `<div class="hud-row${active ? ' active' : ''}" style="top:${text.yPosition}px;left:${text.xPosition}px;width:${text.width}px;height:${text.height}px;padding-left:${text.paddingLength}px;font-size:23px">${esc(text.content)}</div>`
      }

      if (text.containerName === 'hint') {
        return `<div class="hud-hint${text.textColor >= 4 ? ' bright' : ''}" style="${base};top:${text.yPosition}px">${esc(text.content)}</div>`
      }

      const blocks = text.content.split('\n\n')
      return blocks
        .map((block, index) => {
          const top = text.yPosition + index * 54
          return `<div class="hud-line" style="left:${text.xPosition}px;top:${top}px;color:${color};font-size:23px">${esc(block)}</div>`
        })
        .join('')
    })
    .join('')
}

export function receiptLine(receipt: CloseReceipt): string {
  const price = (value: number | null): string =>
    value !== null && Number.isFinite(value) && value > 0 ? fmtPrice(value, 0) : '—'
  const pct = (value: number | null): string => (value !== null && Number.isFinite(value) ? `${value.toFixed(1)}%` : '—')
  return `Liq ${price(receipt.liqBefore)} → ${price(receipt.liqAfter)} · buffer ${pct(receipt.bufferBeforePct)} → ${pct(receipt.bufferAfterPct)}`
}
