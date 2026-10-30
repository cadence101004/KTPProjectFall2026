import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/plugins/regions'
import { GAME_FONT } from '../minigames/shared/font'

// How one clip looks on the timeline. The editor decides; the timeline only draws.
export interface ClipView {
  start: number
  end: number
  label: string
  color: string
  selected: boolean
  hits: number[] // beat map dots, as fractions (0..1) of the way through the clip
}

// How one media clip looks on the media lane.
export interface MediaView {
  start: number
  end: number
  label: string
  selected: boolean
}

// The editor's waveform strip. wavesurfer only draws; playback always goes through AudioClock,
// so what you hear in the editor is timed exactly like the game.
export class Timeline {
  private readonly waves: WaveSurfer
  private readonly regions: ReturnType<typeof RegionsPlugin.create>
  private readonly playhead: HTMLDivElement
  private readonly grid: HTMLDivElement
  private readonly rulerTrack: HTMLDivElement // scrolls and zooms with the waveform
  private readonly knob: HTMLDivElement
  private readonly mediaTrack: HTMLDivElement // the media lane under the waveform; scrolls and zooms with it
  private readonly mediaPlayhead: HTMLDivElement
  private readonly scrollThumb: HTMLDivElement // our own scrollbar's thumb (see onScrollbar)
  private duration = 0

  constructor(container: HTMLElement) {
    // Media lane below the waveform: the second track, holding background videos and images.
    const lane = document.createElement('div')
    lane.className = 'media-lane'
    this.mediaTrack = document.createElement('div')
    this.mediaTrack.className = 'media-track'
    this.mediaPlayhead = document.createElement('div')
    this.mediaPlayhead.className = 'media-playhead'
    lane.append(this.mediaTrack)
    container.after(lane)

    // Our own horizontal scrollbar under the media lane. Browsers always show the plain system arrow over
    // a native scrollbar, so wavesurfer's is hidden and this one (which shows the hook cursor) drives it.
    const scrollbar = document.createElement('div')
    scrollbar.className = 'timeline-scrollbar'
    this.scrollThumb = document.createElement('div')
    this.scrollThumb.className = 'timeline-thumb'
    scrollbar.append(this.scrollThumb)
    lane.after(scrollbar)

    // Scrub bar above the waveform. Normal page DOM (outside wavesurfer), so editor.css styles it.
    const ruler = document.createElement('div')
    ruler.className = 'ruler'
    this.rulerTrack = document.createElement('div')
    this.rulerTrack.className = 'ruler-track'
    this.knob = document.createElement('div')
    this.knob.className = 'ruler-knob'
    this.rulerTrack.append(this.knob)
    ruler.append(this.rulerTrack)
    container.before(ruler)

    this.waves = WaveSurfer.create({
      container,
      height: 120,
      waveColor: '#6fa8c9',
      progressColor: '#6fa8c9', // no "played" tint: our own playhead shows position
      cursorWidth: 0,
      normalize: true,
      minPxPerSec: 50,
      autoScroll: false,
      hideScrollbar: true, // replaced by our own scrollbar, above
    })
    this.regions = this.waves.registerPlugin(RegionsPlugin.create())
    this.useHookCursors()
    this.onScrollbar(scrollbar)
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

  // wavesurfer and its Regions plugin draw inside a shadow DOM and set their own system cursors on clips
  // (grab, default, col-resize), which hid the pirate hook there. This puts a small stylesheet inside that
  // shadow DOM. The cursor variables come from src/ui/cursor.ts and are inherited into it; !important beats
  // the plugin's inline cursors; :host-context follows the page's pressing and dragging states.
  private useHookCursors(): void {
    const root = this.waves.getWrapper().getRootNode()
    if (!(root instanceof ShadowRoot)) return
    const style = document.createElement('style')
    style.textContent = `
      * { cursor: var(--cursor-default, auto) !important; }
      [part~='region'], [part~='region'] * { cursor: var(--cursor-hover, grab) !important; }
      :host-context(html.pressing) * { cursor: var(--cursor-press, pointer) !important; }
      :host-context(html.dragging) * { cursor: var(--cursor-drag, grabbing) !important; }
    `
    root.append(style)
  }

  // Dragging the scrollbar's thumb scrolls the timeline; clicking the track jumps the view there.
  private onScrollbar(scrollbar: HTMLElement): void {
    let grabOffset: number | null = null // where on the thumb it was grabbed, in pixels
    const scrollTo = (clientX: number) => {
      const bar = scrollbar.getBoundingClientRect()
      const total = this.waves.getWrapper().offsetWidth
      this.waves.setScroll(((clientX - bar.left - (grabOffset ?? 0)) / bar.width) * total)
    }
    scrollbar.addEventListener('pointerdown', event => {
      if (this.duration === 0) return
      const thumb = this.scrollThumb.getBoundingClientRect()
      const onThumb = event.clientX >= thumb.left && event.clientX <= thumb.right
      grabOffset = onThumb ? event.clientX - thumb.left : thumb.width / 2 // clicking the track centers the view
      scrollbar.setPointerCapture(event.pointerId)
      scrollTo(event.clientX)
    })
    scrollbar.addEventListener('pointermove', event => {
      if (grabOffset !== null) scrollTo(event.clientX)
    })
    scrollbar.addEventListener('pointerup', () => (grabOffset = null))
  }

  // Sizes and places the scrollbar thumb to match the part of the song in view.
  private syncScrollbar(): void {
    const total = this.waves.getWrapper().offsetWidth
    if (total <= 0) return
    const visible = Math.min(1, this.waves.getWidth() / total)
    this.scrollThumb.style.width = `${visible * 100}%`
    this.scrollThumb.style.left = `${(this.waves.getScroll() / total) * 100}%`
    this.scrollThumb.parentElement!.classList.toggle('full', visible >= 0.999) // nothing to scroll
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

  // Moves the playhead line and the scrub knob. Called every frame, so it also keeps the scrub bar
  // lined up with the waveform's current zoom and scroll.
  setPlayhead(time: number): void {
    if (this.duration === 0) return
    const position = `${(time / this.duration) * 100}%`
    this.playhead.style.left = position
    this.knob.style.left = position
    this.mediaPlayhead.style.left = position
    for (const track of [this.rulerTrack, this.mediaTrack]) {
      track.style.width = `${this.waves.getWrapper().offsetWidth}px`
      track.style.transform = `translateX(${-this.waves.getScroll()}px)`
    }
    this.syncScrollbar()
  }

  // Redraws the media lane's blocks. Each block's index matches its media clip.
  showMedia(clips: MediaView[]): void {
    if (this.duration === 0) return
    const blocks = clips.map((clip, index) => {
      const block = document.createElement('div')
      block.className = clip.selected ? 'media-block selected' : 'media-block'
      block.dataset.index = String(index)
      block.style.left = `${(clip.start / this.duration) * 100}%`
      block.style.width = `${((clip.end - clip.start) / this.duration) * 100}%`
      block.textContent = clip.label
      return block
    })
    this.mediaTrack.replaceChildren(...blocks, this.mediaPlayhead)
  }

  // Clicking a media block selects it; dragging it moves it. `move` gets the dropped start time, before
  // any no-overlap rules (the editor applies those).
  onMediaEdit(select: (index: number) => void, move: (index: number, start: number) => void): void {
    let drag: { index: number; block: HTMLElement; startX: number; startLeft: number; moved: boolean } | null = null
    const secondsPerPixel = () => this.duration / this.mediaTrack.getBoundingClientRect().width
    this.mediaTrack.addEventListener('pointerdown', event => {
      const block = (event.target as HTMLElement).closest<HTMLElement>('.media-block')
      if (!block) return
      const index = Number(block.dataset.index)
      drag = { index, block, startX: event.clientX, startLeft: block.offsetLeft, moved: false }
      this.mediaTrack.setPointerCapture(event.pointerId)
      select(index)
    })
    this.mediaTrack.addEventListener('pointermove', event => {
      if (!drag) return
      const dx = event.clientX - drag.startX
      if (Math.abs(dx) > 3) drag.moved = true
      if (drag.moved) drag.block.style.left = `${drag.startLeft + dx}px` // live preview while dragging
    })
    this.mediaTrack.addEventListener('pointerup', event => {
      if (!drag) return
      const { index, startLeft, startX, moved } = drag
      drag = null
      if (moved) move(index, (startLeft + event.clientX - startX) * secondsPerPixel())
    })
  }

  // Dragging on the scrub bar. Calls back with the time under the pointer when the drag starts, as it
  // moves, and when it's released.
  onScrub(callback: (time: number, phase: 'start' | 'move' | 'end') => void): void {
    const ruler = this.rulerTrack.parentElement!
    const timeAt = (event: PointerEvent) => {
      const rect = this.rulerTrack.getBoundingClientRect()
      return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) * this.duration
    }
    let dragging = false
    ruler.addEventListener('pointerdown', event => {
      if (this.duration === 0) return
      dragging = true
      ruler.setPointerCapture(event.pointerId)
      callback(timeAt(event), 'start')
    })
    ruler.addEventListener('pointermove', event => {
      if (dragging) callback(timeAt(event), 'move')
    })
    ruler.addEventListener('pointerup', event => {
      if (!dragging) return
      dragging = false
      callback(timeAt(event), 'end')
    })
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

// A clip's name tag plus a dot for each beat map hit along its bottom edge. Styled inline for the same
// shadow DOM reason as the playhead.
function clipLabel(clip: ClipView): HTMLElement {
  const content = document.createElement('div')
  Object.assign(content.style, { position: 'relative', height: '100%', pointerEvents: 'none' })

  const label = document.createElement('div')
  label.textContent = clip.label
  Object.assign(label.style, {
    padding: '2px 6px',
    font: `600 12px ${GAME_FONT}`, // inline: page CSS doesn't reach into wavesurfer's shadow DOM
    color: '#fff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    borderTop: clip.selected ? '3px solid #ffcc4d' : '3px solid transparent',
  })
  content.append(label)

  for (const hit of clip.hits) {
    const dot = document.createElement('div')
    Object.assign(dot.style, {
      position: 'absolute',
      bottom: '6px',
      left: `${hit * 100}%`,
      width: '6px',
      height: '6px',
      marginLeft: '-3px',
      borderRadius: '50%',
      background: '#fff',
    })
    content.append(dot)
  }
  return content
}
