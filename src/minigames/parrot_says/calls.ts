// Pure call-and-response logic for Parrot Says. No Phaser in here, so it can be tested with plain Vitest.
// The beat map's hits are the player's answers; the parrot calls each one CALL_BEATS earlier.
import { type Direction, DIRECTIONS } from '../shared/arrows'

export const CALL_BEATS = 4 // the parrot squawks each arrow this many beats before the player answers it

// When the parrot squawks each answer's arrow: CALL_BEATS before it, but never before the clip starts.
export function callTimes(hits: number[], clipStart: number, beatLength: number): number[] {
  return hits.map(hit => Math.max(clipStart, hit - CALL_BEATS * beatLength))
}

// A random arrow for each answer. Repeats are allowed: remembering "up, up, left, up" is part of the fun.
export function pickArrows(count: number, random: () => number): Direction[] {
  return Array.from({ length: count }, () => DIRECTIONS[Math.floor(random() * DIRECTIONS.length)])
}

// Which group of call-and-response a hit belongs to: its cycle of the clip. The slots on screen show one
// group at a time.
export function groupOf(time: number, clipStart: number, cycleLength: number): number {
  return Math.floor((time - clipStart) / cycleLength + 1e-6)
}

// Whether a called arrow is still showing in its slot. At difficulty 1 it stays until answered; from
// difficulty 2 it vanishes one beat after the call, so the player has to remember the sequence.
export function arrowShowing(songTime: number, callAt: number, beatLength: number, difficulty: number): boolean {
  if (songTime < callAt) return false
  return difficulty < 2 || songTime < callAt + beatLength
}
