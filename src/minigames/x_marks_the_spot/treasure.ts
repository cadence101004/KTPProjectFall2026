// Pure treasure logic for X Marks the Spot. No Phaser in here, so it can be tested with plain Vitest.
// Positions are 0..1 across (x) and down (y) the screen. Distances are in screen heights, measured on the
// real screen shape (x is stretched by the aspect ratio), so "near" means the same in every direction.
import type { HitGrade } from '../../types/minigame'

export interface Spot {
  x: number
  y: number
}

export const WALK_SPEED = 0.75 // how fast the pirate walks, in screen heights per second
export const AREA = { left: 0.08, right: 0.92, top: 0.22, bottom: 0.9 } // where X's can appear (clear of the text)
const MIN_TELL = 0.5 // an X with less than this long to reach it (right at the clip start) is left out
const REACH_MARGIN = 0.7 // each X is within this share of the distance the pirate could walk in time

// Difficulty: a smaller X to stand on (its catch radius, in screen heights) and, with beat sync off, digs
// closer together.
export function treasureSettings(difficulty: number): { reach: number; minGap: number; maxGap: number } {
  if (difficulty >= 3) return { reach: 0.065, minGap: 0.65, maxGap: 1.0 }
  if (difficulty >= 2) return { reach: 0.08, minGap: 0.8, maxGap: 1.3 }
  return { reach: 0.1, minGap: 1.0, maxGap: 1.6 }
}

// When each X is dug (song times). Beat sync on: one per beat map hit. Off: random gaps through the clip.
export function digTimes(hits: number[] | null, clipStart: number, duration: number, difficulty: number, random: () => number): number[] {
  const earliest = clipStart + MIN_TELL
  if (hits) return hits.filter(hit => hit >= earliest - 1e-6)
  const { minGap, maxGap } = treasureSettings(difficulty)
  const times: number[] = []
  for (let at = clipStart + 1.2; at < clipStart + duration; at += minGap + random() * (maxGap - minGap)) times.push(at)
  return times
}

// Distance between two spots, in screen heights on the real screen shape.
export function distance(a: Spot, b: Spot, aspect: number): number {
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y)
}

// Where each X appears. Each is within walking reach of the one before (the first, of the pirate's starting
// spot), and at least a little way off, so every X is catchable but still needs a walk.
export function digSpots(times: number[], start: Spot, clipStart: number, aspect: number, random: () => number): Spot[] {
  const spots: Spot[] = []
  let at = start
  let previous = clipStart
  for (const time of times) {
    const reach = WALK_SPEED * (time - previous) * REACH_MARGIN
    const angle = random() * Math.PI * 2
    const far = reach * (0.35 + 0.65 * random())
    at = {
      x: Math.min(AREA.right, Math.max(AREA.left, at.x + (Math.cos(angle) * far) / aspect)),
      y: Math.min(AREA.bottom, Math.max(AREA.top, at.y + Math.sin(angle) * far)),
    }
    spots.push(at)
    previous = time
  }
  return spots
}

// How a dig went: it's a race to the spot, not an aim test. Standing anywhere on the X (within `reach`)
// when it's dug is a Perfect; getting there up to `lateWindow` seconds after is a late Good; later than
// that is a Miss. Returns null while it's still undecided (not there yet, still inside the late window).
// `lateBy` is how long ago the dig was (negative before it).
export function digGrade(off: number, reach: number, lateBy: number, lateWindow: number): HitGrade | null {
  if (lateBy < 0) return null // not dug yet
  if (off <= reach) return lateBy === 0 ? 'perfect' : 'good'
  return lateBy > lateWindow ? 'miss' : null
}
