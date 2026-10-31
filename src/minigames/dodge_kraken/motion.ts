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

// The death fall (deathLift) lives in ../shared/deathFall.ts, since Catch the Fruit uses it too.
