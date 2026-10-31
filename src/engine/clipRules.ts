import type { GameClip } from '../types/level'
import type { MiniGameMeta, TaskMeta } from '../types/minigame'

// How many tasks a clip holds. Task games fit whole cycles of baseBeats at the song's tempo (at least 1);
// duration games are one long rep. A faster song fits more cycles into the same clip.
export function repsFor(meta: MiniGameMeta, clipLength: number, bpm: number): number {
  if (meta.kind === 'duration') return 1
  return Math.max(1, Math.round(clipLength / cycleLength(meta, bpm)))
}

// Seconds in one task cycle at this tempo.
export function cycleLength(meta: TaskMeta, bpm: number): number {
  return meta.baseBeats * (60 / bpm)
}

// Whether a clip of this game uses a beat map: the game has default hits, and (for duration games) beat
// sync is on for the clip.
export function usesBeatMap(meta: MiniGameMeta, clip: GameClip): boolean {
  if (!meta.defaultHits) return false
  return meta.kind === 'task' || (meta.canBeatSync && !!clip.beatSync)
}

// The game's default beat map for a clip of `clipLength` seconds: its one-cycle pattern (one bar for
// duration games) repeated to fill the clip. In beats from the clip's start.
export function defaultHits(meta: MiniGameMeta, clipLength: number, bpm: number): number[] {
  const pattern = meta.defaultHits ?? []
  const cycleBeats = meta.kind === 'task' ? meta.baseBeats : 4
  const clipBeats = clipLength / (60 / bpm)
  const hits: number[] = []
  for (let cycle = 0; cycle * cycleBeats < clipBeats - 1e-6; cycle++) {
    for (const beat of pattern) {
      const hit = cycle * cycleBeats + beat
      if (hit < clipBeats - 1e-6) hits.push(hit)
    }
  }
  return hits
}

// The clip's beat map as song times, for MiniGameParams.hits. Hits past the clip's end (e.g. after the
// clip was shortened) are dropped. Null when the clip doesn't use a beat map.
export function hitTimes(meta: MiniGameMeta, clip: GameClip, bpm: number): number[] | null {
  if (!usesBeatMap(meta, clip)) return null
  const beats = clip.hits ?? defaultHits(meta, clip.end - clip.start, bpm)
  return beats
    .map(beat => clip.start + beat * (60 / bpm))
    .filter(time => time < clip.end - 1e-6)
    .sort((a, b) => a - b)
}

// Every option the game offers, set to the clip's choice or else the option's default. This is what the
// game gets as MiniGameParams.options.
export function optionsFor(meta: MiniGameMeta, clip: Pick<GameClip, 'options'>): Record<string, boolean> {
  return Object.fromEntries((meta.options ?? []).map(option => [option.id, clip.options?.[option.id] ?? option.default]))
}
