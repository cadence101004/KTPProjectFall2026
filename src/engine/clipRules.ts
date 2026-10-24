import type { MiniGameMeta } from '../types/minigame'

// How many tasks a clip holds. Task games fit whole cycles of baseBeats at the song's tempo (at least 1);
// duration games are one long rep. A faster song fits more cycles into the same clip.
export function repsFor(meta: MiniGameMeta, clipLength: number, bpm: number): number {
  if (meta.kind === 'duration') return 1
  const cycleLength = meta.baseBeats * (60 / bpm)
  return Math.max(1, Math.round(clipLength / cycleLength))
}
