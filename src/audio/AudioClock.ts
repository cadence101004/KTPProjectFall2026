// How far ahead to schedule playback so the start time is known exactly (seconds).
const START_LEAD = 0.05

// Owns the AudioContext and the decoded song. Every gameplay system reads time from here.
export class AudioClock {
  private readonly ctx = new AudioContext()
  private buffer: AudioBuffer | null = null
  private source: AudioBufferSourceNode | null = null
  private startedAt = 0
  private startOffset = 0

  // Decodes an uploaded MP3 into memory so it can be started with sample-accurate timing.
  async load(file: Blob): Promise<void> {
    const bytes = await file.arrayBuffer()
    this.buffer = await this.ctx.decodeAudioData(bytes)
  }

  // The decoded song, for drawing its waveform. Null until load() finishes.
  getBuffer(): AudioBuffer | null {
    return this.buffer
  }

  // Starts the song at `offset` seconds of song time. The first call must come from a user gesture.
  async play(offset = 0): Promise<void> {
    if (!this.buffer) throw new Error('AudioClock.play called before load')
    await this.ctx.resume()
    this.stop()

    const source = this.ctx.createBufferSource()
    source.buffer = this.buffer
    source.connect(this.ctx.destination)

    // Schedule slightly in the future so startedAt is the exact moment sample `offset` plays.
    this.startedAt = this.ctx.currentTime + START_LEAD
    this.startOffset = offset
    source.start(this.startedAt, offset)
    this.source = source
  }

  // Current position in the song (seconds), read from the audio clock. Slightly negative during START_LEAD.
  songTime(): number {
    if (!this.source) return this.startOffset
    return this.ctx.currentTime - this.startedAt + this.startOffset
  }

  // Stops playback and freezes songTime where the song stopped, so play(songTime()) resumes it.
  stop(): void {
    if (!this.source) return
    this.startOffset = Math.max(0, this.songTime())
    this.source.stop()
    this.source.disconnect()
    this.source = null
  }
}
