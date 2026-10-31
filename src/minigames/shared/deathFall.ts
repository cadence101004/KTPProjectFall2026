// The Mario-style death fall, shared by every minigame with a pirate who can lose (Dodge the Kraken, Catch
// the Fruit): a short freeze, a jump up, then a fall straight off the bottom of the screen. Driven by song
// time like everything else. No Phaser in here, so it can be tested with plain Vitest.

export const DEATH_FREEZE = 0.25 // seconds frozen before the jump
export const DEATH_RISE = 0.25 // how high the death jump goes, in screen heights
const DEATH_PEAK = 0.35 // seconds from the jump to its peak

// How far above where they lost the pirate is, `sinceDeath` seconds after it, in screen heights. It goes up
// to DEATH_RISE and then keeps falling below 0 (off the screen), like a thrown ball.
// To use it: pirate.y = where they stood - deathLift(songTime - diedAt) * screen height.
export function deathLift(sinceDeath: number): number {
  const t = Math.max(0, sinceDeath - DEATH_FREEZE)
  const gravity = (2 * DEATH_RISE) / DEATH_PEAK ** 2
  return gravity * DEATH_PEAK * t - 0.5 * gravity * t * t
}
