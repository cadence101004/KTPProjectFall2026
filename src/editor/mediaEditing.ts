import type { MediaClip } from '../types/level'

export const MIN_MEDIA_PIECE = 0.25 // seconds: shortest piece a cut may leave on either side

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
