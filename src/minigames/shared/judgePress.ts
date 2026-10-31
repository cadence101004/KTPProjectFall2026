// Shared hit judging for beat map minigames, so every rhythm game feels the same.

// How far from the beat (in seconds, either side) each grade reaches. The same on the early and late side.
export const GRADE_WINDOWS = { perfect: 0.035, great: 0.08, good: 0.16 } as const
export const HIT_WINDOW = GRADE_WINDOWS.good // the widest press that still counts

export type Grade = 'perfect' | 'great' | 'good'

// Beat map games fail once this share of their hits has been missed. Smaller misses just count.
export const MISS_LIMIT = 0.25

// Whether `misses` out of `total` hits is enough to fail: a quarter or more. With 4 hits one miss fails;
// with 8 hits it takes two.
export function tooManyMisses(misses: number, total: number): boolean {
  return total > 0 && misses / total >= MISS_LIMIT
}

export interface Judgement {
  // 'hit': within the window. 'early': before it, in the run-up to the hit (fails the game). 'late': after it
  // (fails the game). 'ignore': too far before the next hit to be aimed at it, or no hits left.
  result: 'hit' | 'early' | 'late' | 'ignore'
  grade: Grade | null // set for a hit
  offset: number // press time minus hit time, in seconds: negative is early, positive is late
}

// The grade for a press `offset` seconds from its hit, or null if it's outside every window.
// `scale` shrinks every window together (difficulty uses it): 1 is the full size.
export function gradeFor(offset: number, scale = 1): Grade | null {
  const distance = Math.abs(offset)
  if (distance <= GRADE_WINDOWS.perfect * scale) return 'perfect'
  if (distance <= GRADE_WINDOWS.great * scale) return 'great'
  if (distance <= GRADE_WINDOWS.good * scale) return 'good'
  return null
}

// Judges a press against the next hit in a beat map. A press before the window counts as 'early' only
// once it's past the halfway point since the previous hit (or since the clip started, for the first hit);
// anything earlier is ignored, so a double tap right after a hit isn't punished.
export function judgePress(hits: number[], nextHit: number, pressTime: number, clipStart: number, scale = 1): Judgement {
  const hit = hits[nextHit]
  if (hit === undefined) return { result: 'ignore', grade: null, offset: 0 }
  const offset = pressTime - hit
  const grade = gradeFor(offset, scale)
  if (grade) return { result: 'hit', grade, offset }
  if (offset > 0) return { result: 'late', grade: null, offset }
  const previous = nextHit > 0 ? hits[nextHit - 1] : clipStart
  return { result: pressTime >= (previous + hit) / 2 ? 'early' : 'ignore', grade: null, offset }
}
