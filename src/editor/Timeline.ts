import WaveSurfer from 'wavesurfer.js'

// The editor's waveform strip. wavesurfer only draws; playback always goes through AudioClock,
// so what you hear in the editor is timed exactly like the game.
export class Timeline {
  private readonly waves: WaveSurfer
  private readonly playhead: HTMLDivElement
  private duration = 0

  constructor(container: HTMLElement) {
    this.waves = WaveSurfer.create({
      container,
      height: 120,
      waveColor: '#6fa8c9',
      progressColor: '#6fa8c9', // no "played" tint: our own playhead shows position
      cursorWidth: 0,
      normalize: true,
      minPxPerSec: 50,
      autoScroll: false,
    })
    // Styled inline: wavesurfer renders inside a shadow DOM, so page CSS never reaches this element.
    this.playhead = document.createElement('div')
    Object.assign(this.playhead.style, {
      position: 'absolute',
      top: '0',
      height: '100%',
      width: '2px',
      background: '#ffcc4d',
      pointerEvents: 'none',
      zIndex: '10',
    })
  }

  // Draws a song from precomputed peaks (see computePeaks). No second decode of the MP3.
  async show(peaks: number[], duration: number): Promise<void> {
    this.duration = duration
    await this.waves.load('', [peaks], duration)
    this.waves.getWrapper().append(this.playhead)
    this.setPlayhead(0)
  }

  // Moves the playhead line. The wrapper is the full zoomed waveform, so the line scrolls with it.
  setPlayhead(time: number): void {
    if (this.duration === 0) return
    this.playhead.style.left = `${(time / this.duration) * 100}%`
  }

  // Calls back with the song time the user clicked or dragged to on the waveform.
  onSeek(callback: (time: number) => void): void {
    this.waves.on('interaction', callback)
  }

  // Pixels per second of song. Higher shows more detail for placing clips.
  zoom(pxPerSecond: number): void {
    if (this.duration > 0) this.waves.zoom(pxPerSecond)
  }
}
