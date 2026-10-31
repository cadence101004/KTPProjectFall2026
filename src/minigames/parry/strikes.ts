// Pure strike logic for Parry!. No Phaser in here, so it can be tested with plain Vitest.
// (Directions, arrow drawing, and grading a direction press live in ../shared/arrows.ts.)
import { type Direction, DIRECTIONS } from '../shared/arrows'

// How many beats of warning (the wind-up, with its arrow) the rival gives before each strike: shorter as
// difficulty rises.
export function tellBeatsFor(difficulty: number): number {
  return difficulty >= 3 ? 0.5 : difficulty >= 2 ? 0.75 : 1
}

// A random direction for each strike, never the same one twice in a row so every strike reads as new.
export function pickDirections(count: number, random: () => number): Direction[] {
  const directions: Direction[] = []
  for (let i = 0; i < count; i++) {
    const choices = DIRECTIONS.filter(direction => direction !== directions[i - 1])
    directions.push(choices[Math.floor(random() * choices.length)])
  }
  return directions
}

// How far through strike `next`'s wind-up the rival is, from 0 (the arrow just appeared) to 1 (the strike
// lands, exactly on its hit). The wind-up starts `tellBeats` before the hit, but never before the previous
// strike (or the clip start), so close strikes each get their own shorter wind-up.
export function windUp(hits: number[], next: number, songTime: number, clipStart: number, beatLength: number, tellBeats: number): number {
  const hit = hits[next]
  if (hit === undefined) return 1
  const previous = next > 0 ? hits[next - 1] : clipStart
  const startsAt = Math.max(previous, hit - tellBeats * beatLength)
  if (hit <= startsAt) return 1
  return Math.min(1, Math.max(0, (songTime - startsAt) / (hit - startsAt)))
}
