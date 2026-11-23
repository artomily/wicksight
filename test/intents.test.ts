import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractPrice, parseIntent, spokenNumberToDigits } from '../server/intents.ts'

test('spoken numbers', () => {
  assert.equal(spokenNumberToDigits('sixty two thousand'), 62_000)
  assert.equal(spokenNumberToDigits('sixty two thousand five hundred'), 62_500)
  assert.equal(spokenNumberToDigits('one hundred and five'), 105)
  assert.equal(spokenNumberToDigits('nothing to see'), null)
})

test('prices in digits, commas, k suffix', () => {
  assert.equal(extractPrice('alert at 62,000'), 62_000)
  assert.equal(extractPrice('alert 62000.5'), 62_000.5)
  assert.equal(extractPrice('alert 62k'), 62_000)
  assert.equal(extractPrice('alert 62 000'), 62_000)
  assert.equal(extractPrice('alert sixty two thousand'), 62_000)
})

test('alert intent', () => {
  assert.deepEqual(parseIntent('alert at 62,000', 64_000), { type: 'alert', price: 62_000 })
  assert.deepEqual(parseIntent('set an alert when it hits sixty two thousand', 64_000), {
    type: 'alert',
    price: 62_000,
  })
})

test('close half variants', () => {
  for (const phrase of ['close half', 'close 50%', 'cut it in half', 'take half off', 'reduce by fifty percent']) {
    assert.deepEqual(parseIntent(phrase, 64_000), { type: 'close_half' }, phrase)
  }
})

test('close all is refused on purpose', () => {
  const intent = parseIntent('close everything', 64_000)
  assert.equal(intent.type, 'none')
  assert.equal(intent.reason, 'close_all_unsupported')
})

test('cancel alert', () => {
  assert.deepEqual(parseIntent('cancel the alert', 64_000), { type: 'cancel_alert' })
})

test('alert without a price is not executed', () => {
  const intent = parseIntent('alert me', 64_000)
  assert.equal(intent.type, 'none')
  assert.equal(intent.reason, 'no_price')
})

test('absurd alert price is rejected', () => {
  const intent = parseIntent('alert 6,000', 64_000)
  assert.equal(intent.type, 'none')
  assert.equal(intent.reason, 'price_out_of_range')
})

test('gibberish falls through', () => {
  const intent = parseIntent('what is my pnl', 64_000)
  assert.equal(intent.type, 'none')
  assert.equal(intent.reason, 'unrecognized')
})
