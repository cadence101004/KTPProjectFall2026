import { cycleLength, repsFor } from '../engine/clipRules'
import type { MiniGameMeta } from '../types/minigame'

// Placement rules for anything on a timeline track: game and buffer clips, and media clips. They only need
// start and end, so every track shares the same no-overlap rules.

export const MIN_BUFFER = 0.25 // seconds: shortest buffer clip
const EPS = 1e-6 // float slack so clips that exactly touch don't count as overlapping

export interface Span {
  start: number
  end: number
}

// The legal length nearest `length`. Task games snap to whole cycles; duration games and buffers have a minimum.
// Pass meta = null for a buffer.
export function snapLength(meta: MiniGameMeta | null, length: number, bpm: number): number {
  if (!meta) return Math.max(MIN_BUFFER, length)
  if (meta.kind === 'duration') return Math.max(meta.minDuration, length)
  return repsFor(meta, length, bpm) * cycleLength(meta, bpm)
}

// The legal length nearest `wanted` that also fits in `room` seconds, or null if even the shortest legal clip won't fit.
export function fitLength(meta: MiniGameMeta | null, wanted: number, room: number, bpm: number): number | null {
  let length = snapLength(meta, Math.min(wanted, room), bpm)
  if (length > room + EPS && meta?.kind === 'task') {
    const cycle = cycleLength(meta, bpm)
    length = Math.floor(room / cycle + EPS) * cycle
  }
  if (length <= EPS || length > room + EPS) return null
  return length
}

// Stretches of the song not covered by any clip, ignoring the clip at `skip` (pass -1 to ignore none).
export function freeGaps(clips: readonly Span[], skip: number, songLength: number): Span[] {
  const others = clips.filter((_, i) => i !== skip).sort((a, b) => a.start - b.start)
  const gaps: Span[] = []
  let cursor = 0
  for (const clip of others) {
    if (clip.start > cursor + EPS) gaps.push({ start: cursor, end: clip.start })
    cursor = Math.max(cursor, clip.end)
  }
  if (songLength > cursor + EPS) gaps.push({ start: cursor, end: songLength })
  return gaps
}

// Where a clip of `length` lands when dropped at `start`: inside the free gap under its center, pushed in
// so it fits. Null if its center is over another clip or the gap is too small. Use index -1 for a new clip.
export function placeMove(clips: readonly Span[], index: number, start: number, length: number, songLength: number): Span | null {
  const center = start + length / 2
  const gap = freeGaps(clips, index, songLength).find(g => center >= g.start - EPS && center <= g.end + EPS)
  if (!gap || gap.end - gap.start < length - EPS) return null
  const clamped = Math.min(Math.max(start, gap.start), gap.end - length)
  return { start: clamped, end: clamped + length }
}

// Drags one edge of clip `index` to `edgeTime`. The other edge stays put, the length snaps for the clip's
// game, and the clip stops at its neighbours. Null if no legal length fits.
export function placeResize(
  clips: readonly Span[],
  index: number,
  side: 'start' | 'end',
  edgeTime: number,
  meta: MiniGameMeta | null,
  bpm: number,
  songLength: number,
): Span | null {
  const clip = clips[index]
  const gap = freeGaps(clips, index, songLength).find(g => clip.start >= g.start - EPS && clip.end <= g.end + EPS)
  if (!gap) return null
  const room = side === 'end' ? gap.end - clip.start : clip.end - gap.start
  const wanted = side === 'end' ? edgeTime - clip.start : clip.end - edgeTime
  const length = fitLength(meta, wanted, room, bpm)
  if (length === null) return null
  return side === 'end' ? { start: clip.start, end: clip.start + length } : { start: clip.end - length, end: clip.end }
}
