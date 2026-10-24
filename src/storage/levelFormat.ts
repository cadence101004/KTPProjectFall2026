import type { Clip, Level, MediaClip } from '../types/level'

// Turns stored or imported JSON into a valid Level: fills in fields that older levels lack, drops broken
// clips, and sorts clips by start time. Throws if the data isn't a level at all.
export function normalizeLevel(raw: unknown): Level {
  if (typeof raw !== 'object' || raw === null || !Array.isArray((raw as { clips?: unknown }).clips)) {
    throw new Error('Not a PirateWare level')
  }
  const data = raw as Partial<Level>
  const clips = (data.clips ?? []).filter(isValidClip).sort((a, b) => a.start - b.start)
  return {
    title: typeof data.title === 'string' && data.title ? data.title : 'Untitled level',
    audioHash: typeof data.audioHash === 'string' ? data.audioHash : '',
    bpm: typeof data.bpm === 'number' && data.bpm > 0 ? data.bpm : 120,
    beatOffset: typeof data.beatOffset === 'number' && data.beatOffset >= 0 ? data.beatOffset : 0,
    ...(typeof data.countdownRate === 'number' ? { countdownRate: data.countdownRate } : {}),
    clips,
    media: Array.isArray(data.media) ? (data.media as MediaClip[]) : [],
  }
}

function isValidClip(clip: unknown): clip is Clip {
  if (typeof clip !== 'object' || clip === null) return false
  const c = clip as Partial<Clip> & { gameId?: unknown }
  if (typeof c.start !== 'number' || typeof c.end !== 'number' || !(c.end > c.start)) return false
  return c.type === 'buffer' || (c.type === 'game' && typeof c.gameId === 'string')
}
