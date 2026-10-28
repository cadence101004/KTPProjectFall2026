// Pure slam logic for Dodge the Kraken. No Phaser in here, so it can be tested with plain Vitest.

export const LANES = 3
export const WARN_BEATS = 1 // beat sync on: the shadow appears this many beats before its slam
const MIN_WARN_BEATS = 0.5 // a synced slam with less warning than this (right at the clip start) is dropped

// One tentacle slam: the shadow appears at warnAt, and it hits `lanes` at `at` (song times).
export interface Slam {
  warnAt: number
  at: number
  lanes: number[]
}

export interface SlamSettings {
  warning: number // beat sync off: seconds of warning before each slam
  minGap: number // beat sync off: shortest and longest time between slams, in seconds
  maxGap: number
  doubleChance: number // chance a slam hits two lanes at once (never all three)
}

// Difficulty shortens warnings and gaps, and brings in two-lane slams.
export function slamSettings(difficulty: number): SlamSettings {
  if (difficulty >= 3) return { warning: 0.45, minGap: 0.6, maxGap: 1.0, doubleChance: 0.5 }
  if (difficulty >= 2) return { warning: 0.6, minGap: 0.8, maxGap: 1.2, doubleChance: 0.25 }
  return { warning: 0.8, minGap: 1.0, maxGap: 1.5, doubleChance: 0 }
}

// Which lanes a slam hits: one random lane, or (by doubleChance) two. One lane is always left safe.
export function pickLanes(doubleChance: number, random: () => number): number[] {
  const first = Math.floor(random() * LANES)
  if (random() >= doubleChance) return [first]
  const second = (first + 1 + Math.floor(random() * (LANES - 1))) % LANES
  return [first, second].sort((a, b) => a - b)
}

// Beat sync on: one slam on each beat map hit, with its shadow WARN_BEATS before. Near the clip start the
// warning is shortened to fit, and a slam with less than MIN_WARN_BEATS of warning is dropped as unfair.
export function syncedSlams(hits: number[], beatLength: number, clipStart: number, difficulty: number, random: () => number): Slam[] {
  const { doubleChance } = slamSettings(difficulty)
  return hits
    .filter(hit => hit - clipStart >= MIN_WARN_BEATS * beatLength - 1e-6)
    .map(hit => ({
      warnAt: Math.max(clipStart, hit - WARN_BEATS * beatLength),
      at: hit,
      lanes: pickLanes(doubleChance, random),
    }))
}

// Beat sync off: slams at random gaps from the first warning to the clip's end.
export function freeSlams(clipStart: number, duration: number, difficulty: number, random: () => number): Slam[] {
  const { warning, minGap, maxGap, doubleChance } = slamSettings(difficulty)
  const slams: Slam[] = []
  for (let at = clipStart + warning; at < clipStart + duration; at += minGap + random() * (maxGap - minGap)) {
    slams.push({ warnAt: at - warning, at, lanes: pickLanes(doubleChance, random) })
  }
  return slams
}

// Moves the player one lane left (-1) or right (+1), stopping at the edges.
export function stepLane(lane: number, direction: -1 | 1): number {
  return Math.min(LANES - 1, Math.max(0, lane + direction))
}
