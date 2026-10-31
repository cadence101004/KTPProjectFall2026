import type { MediaClip } from '../types/level'

export const MIN_MEDIA_PIECE = 0.25 // seconds: shortest piece a cut may leave on either side

// Where a media clip's edges land when the `side` edge is dragged to `to` (already snapped and kept clear
// of neighbours). Trimming the start keeps the video in place: the clip skips further into the file
// instead of sliding it, so the same scene stays at the same moment of the song. A video's start can't be
// dragged back past the beginning of its file, and a clip never gets shorter than MIN_MEDIA_PIECE.
export function trimMedia(clip: MediaClip, side: 'start' | 'end', to: number): MediaClip {
  if (side === 'end') return { ...clip, end: Math.max(to, clip.start + MIN_MEDIA_PIECE) }
  const earliest = clip.kind === 'video' ? clip.start - clip.mediaOffset : -Infinity // the file's first frame
  const start = Math.min(Math.max(to, earliest), clip.end - MIN_MEDIA_PIECE)
  const mediaOffset = clip.kind === 'video' ? clip.mediaOffset + (start - clip.start) : clip.mediaOffset
  return { ...clip, start, mediaOffset }
}

// Cuts a media clip in two at song time `at`. The video stays continuous: the second piece's mediaOffset
// starts exactly where the first piece ends, so playback across the cut is seamless. Each piece gets its
// own copy of the effects, so they can be blurred and dimmed separately. Null if `at` is too close to an
// edge (or outside the clip).
export function cutMedia(clip: MediaClip, at: number): [MediaClip, MediaClip] | null {
  if (at - clip.start < MIN_MEDIA_PIECE || clip.end - at < MIN_MEDIA_PIECE) return null
  const before: MediaClip = { ...clip, end: at, effects: { ...clip.effects } }
  const after: MediaClip = {
    ...clip,
    start: at,
    mediaOffset: clip.kind === 'video' ? clip.mediaOffset + (at - clip.start) : clip.mediaOffset,
    effects: { ...clip.effects },
  }
  return [before, after]
}
