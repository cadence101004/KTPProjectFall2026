import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/plugins/regions'

// How one clip looks on the timeline. The editor decides; the timeline only draws.
export interface ClipView {
  start: number
  end: number
  label: string
  color: string
  selected: boolean
}

// The editor's waveform strip. wavesurfer only draws; playback always goes through AudioClock,
// so what you hear in the editor is timed exactly like the game.
export class Timeline {
  private readonly waves: WaveSurfer
  private readonly regions: ReturnType<typeof RegionsPlugin.create>
  private readonly playhead: HTMLDivElement
  private readonly grid: HTMLDivElement
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
    this.regions = this.waves.registerPlugin(RegionsPlugin.create())
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
    this.grid = document.createElement('div')
    Object.assign(this.grid.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '1' })
  }

  // Draws a song from precomputed peaks (see computePeaks). No second decode of the MP3.
  async show(peaks: number[], duration: number): Promise<void> {
    this.duration = duration
    await this.waves.load('', [peaks], duration)
    this.waves.getWrapper().append(this.grid, this.playhead)
    this.setPlayhead(0)
  }

  // Draws a faint line on every beat and a brighter one at the start of each bar. Positions are
  // percentages of the song, so the lines stay put through zoom and scroll.
  showBeatGrid(beats: { time: number; barStart: boolean }[]): void {
    if (this.duration === 0) return
    this.grid.replaceChildren(
      ...beats.map(beat => {
        const line = document.createElement('div')
        Object.assign(line.style, {
          position: 'absolute',
          top: '0',
          height: '100%',
          width: '1px',
          left: `${(beat.time / this.duration) * 100}%`,
          background: beat.barStart ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.1)',
        })
        return line
      }),
    )
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

  // Redraws every clip from scratch. Each region's id is its clip's index.
  showClips(clips: ClipView[]): void {
    if (this.duration === 0) return
    this.regions.clearRegions()
    clips.forEach((clip, index) => {
      this.regions.addRegion({
        id: String(index),
        start: clip.start,
        end: clip.end,
        color: clip.color,
        content: clipLabel(clip),
        drag: true,
        resize: true,
      })
    })
  }

  // Calls back when the user finishes dragging a clip (side undefined) or resizing one of its edges.
  onClipEdit(callback: (index: number, side: 'start' | 'end' | undefined, start: number, end: number) => void): void {
    this.regions.on('region-updated', (region, side) => callback(Number(region.id), side, region.start, region.end))
  }

  // Calls back when a clip is clicked. The click does not also move the playhead.
  onClipClick(callback: (index: number) => void): void {
    this.regions.on('region-clicked', (region, event) => {
      event.stopPropagation()
      callback(Number(region.id))
    })
  }
}

// A clip's name tag. Styled inline for the same shadow DOM reason as the playhead.
function clipLabel(clip: ClipView): HTMLElement {
  const label = document.createElement('div')
  label.textContent = clip.label
  Object.assign(label.style, {
    padding: '2px 6px',
    font: '600 12px system-ui, sans-serif',
    color: '#fff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    pointerEvents: 'none',
    borderTop: clip.selected ? '3px solid #ffcc4d' : '3px solid transparent',
  })
  return label
}
