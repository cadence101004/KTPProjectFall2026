import type { MediaClip } from '../types/level'

export const DRIFT_LIMIT = 0.1 // seconds a video may drift from the song before it's re-synced

// Where in a media clip's video file playback should be at `songTime`.
export function videoTimeAt(clip: MediaClip, songTime: number): number {
  return songTime - clip.start + clip.mediaOffset
}

// The media clip on screen at `songTime`, or null. Clips whose files aren't loaded are skipped, so missing
// media falls back to the default background instead of stopping the level.
export function mediaAt(clips: MediaClip[], songTime: number, loaded: (hash: string) => boolean): MediaClip | null {
  return clips.find(clip => songTime >= clip.start && songTime < clip.end && loaded(clip.mediaHash)) ?? null
}

// The level's media track: background images and videos drawn behind the game canvas, under a frosted
// blur-and-dim cover. Videos are always muted and follow the song clock, never the other way round.
// It runs its own frame loop, so any page showing the game can use it.
export class MediaLayer {
  private readonly video = document.createElement('video')
  private readonly image = document.createElement('img')
  private readonly shade = document.createElement('div') // the dim half of the frosted cover
  private readonly getTime: () => number
  private readonly isPlaying: () => boolean
  private clips: MediaClip[] = []
  private urls = new Map<string, string>() // mediaHash -> object URL of the file
  private enabled = true
  private shown: MediaClip | null = null

  // `container` is the element holding the game canvas. `getTime` and `isPlaying` come from the host page,
  // so the editor can show the frame under a paused playhead.
  constructor(container: HTMLElement, getTime: () => number, isPlaying: () => boolean) {
    this.getTime = getTime
    this.isPlaying = isPlaying
    this.video.muted = true
    this.video.playsInline = true
    this.video.preload = 'auto'
    for (const element of [this.video, this.image, this.shade]) {
      element.className = 'media-layer'
      element.hidden = true
    }
    this.video.addEventListener('error', () => this.show(null)) // a broken file shows the default background
    container.prepend(this.video, this.image, this.shade)
    requestAnimationFrame(this.tick)
  }

  // Updates what the track holds. `urls` maps each media file's hash to a playable URL.
  setMedia(clips: MediaClip[], urls: Map<string, string>, enabled: boolean): void {
    this.clips = clips
    this.urls = urls
    this.enabled = enabled
  }

  private tick = (): void => {
    const time = this.getTime()
    const clip = this.enabled ? mediaAt(this.clips, time, hash => this.urls.has(hash)) : null
    if (clip !== this.shown) this.show(clip)
    if (clip) this.applyEffects(clip)
    if (clip?.kind === 'video') this.syncVideo(clip, time)
    requestAnimationFrame(this.tick)
  }

  // Swaps which file is on screen (or none).
  private show(clip: MediaClip | null): void {
    this.shown = clip
    this.video.hidden = clip?.kind !== 'video'
    this.image.hidden = clip?.kind !== 'image'
    this.shade.hidden = !clip
    if (!clip) {
      this.video.pause()
      return
    }
    const url = this.urls.get(clip.mediaHash)!
    const element = clip.kind === 'video' ? this.video : this.image
    if (element.src !== url) element.src = url
  }

  // Effects are re-applied every frame so editor slider changes show up live.
  private applyEffects(clip: MediaClip): void {
    const filter = `blur(${clip.effects.blur}px)`
    this.video.style.filter = filter
    this.image.style.filter = filter
    this.shade.style.opacity = String(clip.effects.dim)
  }

  // Keeps the video on the song clock: seek only when it drifts past DRIFT_LIMIT, so playback stays smooth.
  private syncVideo(clip: MediaClip, songTime: number): void {
    const target = videoTimeAt(clip, songTime)
    if (Number.isFinite(this.video.duration) && target >= this.video.duration) return // the video has ended
    if (Math.abs(this.video.currentTime - target) > DRIFT_LIMIT) this.video.currentTime = target
    if (this.isPlaying() && this.video.paused) void this.video.play().catch(() => undefined)
    if (!this.isPlaying() && !this.video.paused) this.video.pause()
  }
}
