import { loadLatencyMs } from '../settings/timing'

// How far ahead to schedule playback so the start time is known exactly (seconds).
const START_LEAD = 0.05

// Owns the AudioContext and the decoded song. Every gameplay system reads time from here.
export class AudioClock {
  private readonly ctx = new AudioContext()
  private buffer: AudioBuffer | null = null
  private source: AudioBufferSourceNode | null = null
  private startedAt = 0
  private startOffset = 0 // where in the song the audio started (or stopped)
  private readonly sfx = new Set<AudioBufferSourceNode>() // scheduled sound effects, stopped with the song
  // How late the player hears the audio (seconds), from the Timing Calibration page. songTime() runs this
  // much behind the audio clock, so it matches what the player actually hears.
  private latency = loadLatencyMs() / 1000

  // Changes the calibration while running (the calibration page uses it).
  setLatency(seconds: number): void {
    this.latency = seconds
  }

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

  // Current position in the song (seconds) as the player hears it: the audio clock, minus their calibrated
  // latency. Every gameplay system reads this, so beats, inputs, and visuals all line up with what they
  // hear. Slightly negative just after play() starts. While stopped, it's where the song will resume.
  songTime(): number {
    if (!this.source) return this.startOffset
    return this.audioTime() - this.latency
  }

  // Where the audio itself is in the song right now, ignoring latency.
  private audioTime(): number {
    return this.ctx.currentTime - this.startedAt + this.startOffset
  }

  // Decodes a sound effect from a URL (e.g. '/assets/audio/321GO_sfx.mp3') for playSfx.
  async loadSfx(url: string): Promise<AudioBuffer> {
    const response = await fetch(url)
    return this.ctx.decodeAudioData(await response.arrayBuffer())
  }

  // Plays a sound effect at a song time, scheduled on the music's own clock so it lands exactly in sync.
  // If that time has already passed it joins partway through. `rate` changes speed (and pitch).
  // No latency correction needed: the sound effect and the music reach the player's ears equally late.
  playSfx(buffer: AudioBuffer, songTime: number, rate = 1, fileOffset = 0): void {
    if (!this.source) return
    let when = this.startedAt + (songTime - this.startOffset)
    if (when < this.ctx.currentTime) {
      fileOffset += (this.ctx.currentTime - when) * rate
      when = this.ctx.currentTime
    }
    if (fileOffset >= buffer.duration) return
    const sound = this.ctx.createBufferSource()
    sound.buffer = buffer
    sound.playbackRate.value = rate
    sound.connect(this.ctx.destination)
    sound.start(when, fileOffset)
    sound.onended = () => this.sfx.delete(sound)
    this.sfx.add(sound)
  }

  // Stops playback and freezes songTime where the song stopped, so play(songTime()) resumes it.
  // Pending and playing sound effects stop too.
  stop(): void {
    for (const sound of this.sfx) sound.stop()
    this.sfx.clear()
    if (!this.source) return
    this.startOffset = Math.max(0, this.audioTime()) // resume from where the audio actually is
    this.source.stop()
    this.source.disconnect()
    this.source = null
  }
}
