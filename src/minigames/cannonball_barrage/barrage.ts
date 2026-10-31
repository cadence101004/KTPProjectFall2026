// Pure cannonball logic for Cannonball Barrage. No Phaser in here, so it can be tested with plain Vitest.

export type BallHeight = 'high' | 'low'

export const FLY_TIME = 1 // seconds a ball takes from the enemy cannon to the pirate
export const JUMP_TIME = 0.55 // seconds a jump lasts, from leaving the deck to landing
export const JUMP_HEIGHT = 0.22 // how high a jump goes, in screen heights
export const LOW_CLEAR = 0.07 // how high (screen heights) she must be to clear a low ball
const MIN_FLY = 0.5 // a ball with less than this long to fly (right at the clip start) is left out

// Difficulty, with beat sync off: balls closer together.
export function barrageSettings(difficulty: number): { minGap: number; maxGap: number } {
  if (difficulty >= 3) return { minGap: 0.6, maxGap: 0.9 }
  if (difficulty >= 2) return { minGap: 0.75, maxGap: 1.15 }
  return { minGap: 0.9, maxGap: 1.4 }
}

// When each ball reaches the pirate (song times). Beat sync on: one per beat map hit. Off: random gaps.
export function arrivalTimes(hits: number[] | null, clipStart: number, duration: number, difficulty: number, random: () => number): number[] {
  const earliest = clipStart + MIN_FLY
  if (hits) return hits.filter(hit => hit >= earliest - 1e-6)
  const { minGap, maxGap } = barrageSettings(difficulty)
  const times: number[] = []
  for (let at = clipStart + FLY_TIME; at < clipStart + duration; at += minGap + random() * (maxGap - minGap)) times.push(at)
  return times
}

// High or low for each ball, at random.
export function pickHeights(count: number, random: () => number): BallHeight[] {
  return Array.from({ length: count }, () => (random() < 0.5 ? 'high' : 'low'))
}

// How far along its flight a ball is: 0 leaving the cannon, 1 reaching the pirate (on its arrival time),
// and past 1 after (a dodged ball flies on). Balls near the clip start fly faster to arrive on time.
export function flight(songTime: number, arrival: number, clipStart: number): number {
  const fly = Math.min(FLY_TIME, arrival - clipStart)
  return (songTime - (arrival - fly)) / fly
}

// How high (screen heights) the pirate is, `sinceJump` seconds into a jump: 0 on the deck, up to
// JUMP_HEIGHT halfway, back to 0 on landing. A simple arc, like a thrown ball.
export function jumpLift(sinceJump: number): number {
  if (sinceJump < 0 || sinceJump >= JUMP_TIME) return 0
  const p = sinceJump / JUMP_TIME
  return 4 * JUMP_HEIGHT * p * (1 - p)
}

// Whether the pirate dodged a ball as it reached her: under a high one by ducking, over a low one by being
// high enough in a jump.
export function dodged(height: BallHeight, lift: number, ducking: boolean): boolean {
  return height === 'high' ? ducking : lift >= LOW_CLEAR
}
