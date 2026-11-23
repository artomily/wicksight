import { AudioInputSource, type EvenAppBridge } from '@evenrealities/even_hub_sdk'

const BYTES_PER_SECOND = 16_000 * 2

export class VoiceRecorder {
  private chunks: Uint8Array[] = []
  private bytes = 0
  private open = false
  private source: AudioInputSource | null = null
  private readonly bridge: EvenAppBridge

  constructor(bridge: EvenAppBridge) {
    this.bridge = bridge
  }

  async start(): Promise<{ ok: boolean; source: AudioInputSource | null }> {
    let ok = await this.bridge.audioControl(true, AudioInputSource.Glasses)
    let source: AudioInputSource = AudioInputSource.Glasses
    if (!ok) {
      ok = await this.bridge.audioControl(true, AudioInputSource.Phone)
      source = AudioInputSource.Phone
    }
    this.open = ok
    this.source = ok ? source : null
    return { ok, source: this.source }
  }

  push(pcm: Uint8Array): void {
    if (!this.open || pcm.length === 0) return
    this.chunks.push(pcm)
    this.bytes += pcm.length
  }

  get durationSeconds(): number {
    return this.bytes / BYTES_PER_SECOND
  }

  async stop(): Promise<Uint8Array> {
    this.open = false
    await this.bridge.audioControl(false)
    // Let the last buffered 100 ms frame arrive before we snapshot.
    await new Promise((resolve) => setTimeout(resolve, 150))
    const out = new Uint8Array(this.bytes)
    let offset = 0
    for (const chunk of this.chunks) {
      out.set(chunk, offset)
      offset += chunk.length
    }
    this.chunks = []
    this.bytes = 0
    return out
  }
}
