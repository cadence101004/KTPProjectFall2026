// Pure fruit logic for Catch the Fruit. No Phaser in here, so it can be tested with plain Vitest.
import type { HitGrade } from '../../types/minigame'

export const FRUITS = ['apple', 'banana', 'cherry', 'orange', 'peach', 'pineapple', 'strawberry']
export const FALL_TIME = 1 // seconds a fruit takes to fall from the top of the screen into the bucket
export const WALK_SPEED = 0.6 // how fast the pirate walks, in screen widths per second
const MIN_FALL = 0.5 // a fruit with less than this long to fall (right at the clip start) is dropped as unfair
const EDGE = 0.1 // fruit lands at least this far (in screen widths) from the screen's sides
const REACH_MARGIN = 0.7 // fruit spawns within this share of the distance the pirate could walk in time

// Difficulty: a smaller bucket (catch radius, in screen widths) and, with beat sync off, fruit closer together.
export function fruitSettings(difficulty: number): { reach: number; minGap: number; maxGap: number } {
  if (difficulty >= 3) return { reach: 0.06, minGap: 0.5, maxGap: 0.8 }
  if (difficulty >= 2) return { reach: 0.075, minGap: 0.6, maxGap: 1.0 }
  return { reach: 0.09, minGap: 0.75, maxGap: 1.2 }
}

// When each fruit lands in the bucket (song times). Beat sync on: one per beat map hit. Off: random gaps.
// Fruit without at least MIN_FALL seconds to fall after the clip starts is left out.
export function landTimes(
  hits: number[] | null,
  clipStart: number,
  duration: number,
  difficulty: number,
  random: () => number,
): number[] {
  const earliest = clipStart + MIN_FALL
  if (hits) return hits.filter(hit => hit >= earliest - 1e-6)
  const { minGap, maxGap } = fruitSettings(difficulty)
  const times: number[] = []
  for (let at = clipStart + FALL_TIME; at < clipStart + duration; at += minGap + random() * (maxGap - minGap)) times.push(at)
  return times
}

// Where each fruit lands (0..1 across the screen). Each one is within walking reach of the one before, so
// every fruit can be caught; the first is within reach of the pirate's starting spot.
export function landSpots(times: number[], startX: number, clipStart: number, random: () => number): number[] {
  const spots: number[] = []
  let x = startX
  let previous = clipStart
  for (const time of times) {
    const reach = Math.min(1, WALK_SPEED * (time - previous) * REACH_MARGIN)
    x = Math.min(1 - EDGE, Math.max(EDGE, x + (random() * 2 - 1) * reach))
    spots.push(x)
    previous = time
  }
  return spots
}

// How far down a fruit is, from 0 (top of the screen) to 1 (in the bucket, on its land time). It's 0 before
// it starts falling, and keeps going past 1 after (a dropped fruit falls on past the bucket).
export function fallProgress(songTime: number, landAt: number, clipStart: number): number {
  const fall = Math.min(FALL_TIME, landAt - clipStart) // fruit near the clip start falls faster
  return (songTime - (landAt - fall)) / fall
}

// How well a fruit was caught, by how far (in screen widths) it landed from the bucket's center.
export function catchGrade(distance: number, reach: number): HitGrade {
  const off = Math.abs(distance) / reach
  if (off <= 0.35) return 'perfect'
  if (off <= 0.7) return 'great'
  if (off <= 1) return 'good'
  return 'miss'
}
