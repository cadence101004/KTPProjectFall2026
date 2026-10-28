// Pure animation timing for the pirate in Dodge the Kraken. Everything is driven by song time, like the
// rest of the game. No Phaser in here, so it can be tested with plain Vitest.

export const HOP_TIME = 0.18 // seconds a lane hop takes
export const HOP_HEIGHT = 0.08 // how high the hop arcs, in screen heights

// How far through a lane hop the pirate is, from 0 (just left the old lane) to 1 (landed). 1 if no hop
// is happening.
export function hopProgress(songTime: number, hopAt: number): number {
  return Math.min(1, Math.max(0, (songTime - hopAt) / HOP_TIME))
}

// How high the pirate is above the deck during a hop: 0 at take-off and landing, HOP_HEIGHT halfway.
export function hopLift(progress: number): number {
  return Math.sin(Math.PI * progress) * HOP_HEIGHT
}

// The Mario-style death: a short freeze, a jump up, then a fall straight off the bottom of the screen.
export const DEATH_FREEZE = 0.25 // seconds frozen before the jump
export const DEATH_RISE = 0.25 // how high the death jump goes, in screen heights
const DEATH_PEAK = 0.35 // seconds from the jump to its peak

// How far above where they were squashed the pirate is, `sinceDeath` seconds after it, in screen heights.
// It goes up to DEATH_RISE and then keeps falling below 0 (off the screen), like a thrown ball.
export function deathLift(sinceDeath: number): number {
  const t = Math.max(0, sinceDeath - DEATH_FREEZE)
  const gravity = (2 * DEATH_RISE) / DEATH_PEAK ** 2
  return gravity * DEATH_PEAK * t - 0.5 * gravity * t * t
}
