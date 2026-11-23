import { config } from './config.ts'

export interface Transcript {
  text: string
  provider: string
  latencyMs: number
}

type LocalPipeline = (
  audio: Float32Array,
  options: Record<string, unknown>,
) => Promise<{ text?: string } | Array<{ text?: string }>>

let localPipeline: LocalPipeline | null = null
let loadPromise: Promise<LocalPipeline> | null = null
let queue: Promise<unknown> = Promise.resolve()

const MODEL = config.asrModel

async function getLocalPipeline(): Promise<LocalPipeline> {
  if (localPipeline) return localPipeline
  if (!loadPromise) {
    loadPromise = (async () => {
      const started = Date.now()
      const { pipeline } = await import('@huggingface/transformers')
      const asr = (await pipeline('automatic-speech-recognition', MODEL, { dtype: 'q8' })) as unknown as LocalPipeline
      localPipeline = asr
      console.log(`[asr] ${MODEL} ready in ${Date.now() - started}ms (local, no API key)`)
      return asr
    })().catch((err) => {
      loadPromise = null
      throw err
    })
  }
  return loadPromise
}

export async function warmAsr(): Promise<void> {
  if (config.asrProvider !== 'local') return
  try {
    await getLocalPipeline()
  } catch (err) {
    console.warn('[asr] warm-up failed:', (err as Error).message)
  }
}

function pcm16ToFloat32(pcm: Buffer): Float32Array {
  const samples = Math.floor(pcm.length / 2)
  const out = new Float32Array(samples)
  for (let i = 0; i < samples; i++) out[i] = pcm.readInt16LE(i * 2) / 32768
  return out
}

function rms(audio: Float32Array): number {
  if (!audio.length) return 0
  let sum = 0
  for (let i = 0; i < audio.length; i++) sum += audio[i] * audio[i]
  return Math.sqrt(sum / audio.length)
}

function wavFromPcm16(pcm: Buffer, sampleRate = 16_000): Buffer {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

async function transcribeLocal(pcm: Buffer): Promise<string> {
  const asr = await getLocalPipeline()
  const audio = pcm16ToFloat32(pcm)
  const result = await asr(audio, {
    sampling_rate: 16_000,
    chunk_length_s: 30,
  })
  const text = Array.isArray(result) ? result[0]?.text : result.text
  return (text ?? '').trim()
}

async function transcribeOpenAi(pcm: Buffer): Promise<string> {
  if (!config.openai.apiKey) throw new Error('OPENAI_API_KEY is not set')
  const form = new FormData()
  form.append('file', new Blob([wavFromPcm16(pcm)], { type: 'audio/wav' }), 'command.wav')
  form.append('model', config.openai.sttModel)
  form.append('language', 'en')
  form.append('response_format', 'json')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.openai.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`OpenAI STT failed (${res.status})`)
  const json = (await res.json()) as { text?: string }
  return (json.text ?? '').trim()
}

export async function transcribePcm(pcm: Buffer): Promise<Transcript> {
  const started = Date.now()
  if (pcm.length < 3_200) throw new Error('Recording is too short')
  if (pcm.length > 16_000 * 2 * 20) throw new Error('Recording is too long')

  if (config.asrProvider === 'local') {
    const audio = pcm16ToFloat32(pcm)
    if (rms(audio) < 0.004) {
      return { text: '', provider: 'local', latencyMs: Date.now() - started }
    }
  }

  // One transcription at a time keeps CPU predictable on a laptop demo.
  const run = queue.then(() =>
    config.asrProvider === 'openai' ? transcribeOpenAi(pcm) : transcribeLocal(pcm),
  )
  queue = run.catch(() => undefined)
  const text = await run

  return {
    text: text.replace(/\s+/g, ' ').trim(),
    provider: config.asrProvider,
    latencyMs: Date.now() - started,
  }
}
