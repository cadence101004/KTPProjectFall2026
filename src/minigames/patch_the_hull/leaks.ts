// Pure leak logic for Patch the Hull. No Phaser in here, so it can be tested with plain Vitest.

export interface LeakSpot {
  x: number // 0..1 across the screen
  y: number // 0..1 down the screen
}

// Where leaks may spring: the hull wall, clear of the screen edges and the HUD text at the top.
export const HULL_AREA = { left: 0.15, right: 0.85, top: 0.3, bottom: 0.85 }

// Shortest distance between two leaks (in 0..1 screen units), so one click never plugs two at once.
export const MIN_LEAK_GAP = 0.2

// How many random tries each leak gets to find a clear spot before it settles for its last try.
const MAX_TRIES = 100

// Picks `count` leak positions inside HULL_AREA, each at least MIN_LEAK_GAP from the others.
// `random` returns numbers in [0, 1) like Math.random. The game passes a real RNG; tests pass a seeded one.
export function pickLeakSpots(count: number, random: () => number): LeakSpot[] {
  const { left, right, top, bottom } = HULL_AREA
  const spots: LeakSpot[] = []
  while (spots.length < count) {
    let spot: LeakSpot = { x: 0, y: 0 }
    for (let tries = 0; tries < MAX_TRIES; tries++) {
      spot = { x: left + random() * (right - left), y: top + random() * (bottom - top) }
      if (spots.every((other) => Math.hypot(spot.x - other.x, spot.y - other.y) >= MIN_LEAK_GAP)) break
    }
    spots.push(spot) // if every try was too close, keep the last one so the game always gets `count` leaks
  }
  return spots
}

// How big a leak is: its radius as a fraction of the screen height. Drawing and hit testing both use this.
export const LEAK_RADIUS = 0.06

// Did a click at `pointer` land on `leak`? Both are in 0..1 screen units.
// `aspect` is screen width / height. Stretching x by it turns the 0..1 square back into the real screen shape,
// so the clickable area is the same circle the player sees, not an ellipse squashed by the screen size.
export function isPlugged(pointer: LeakSpot, leak: LeakSpot, aspect: number, radius = LEAK_RADIUS): boolean {
  return Math.hypot((pointer.x - leak.x) * aspect, pointer.y - leak.y) <= radius
}
