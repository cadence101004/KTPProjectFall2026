// Pure grime logic for Swab the Deck. No Phaser in here, so it can be tested with plain Vitest.

export interface Point {
  x: number // 0..1 across the screen
  y: number // 0..1 down the screen
}

// Where grime may appear: the deck, clear of the screen edges and the text at the top.
export const DECK_AREA = { left: 0.12, right: 0.88, top: 0.32, bottom: 0.88 }

// Shortest distance between two spots (in 0..1 screen units), so they read as separate spots.
export const MIN_SPOT_GAP = 0.2

// How many random tries each spot gets to find a clear place before it settles for its last try.
const MAX_TRIES = 100

export interface GrimeSettings {
  count: number // spots per cycle
  radius: number // spot size, as a fraction of the screen height
  dirt: number // how much scrubbing each spot needs: total mop travel over it, in screen heights
}

// How much farther than a spot's own edge the mop still scrubs it: the mop ring's radius, as a fraction
// of the spot's radius. Touching a spot with the ring counts, not just passing the ring's center over it.
export const MOP_REACH = 0.7

// Difficulty adds spots, makes them smaller, and makes them need more scrubbing. At difficulty 1 a spot
// cleans with two or three quick rubs.
export function grimeFor(difficulty: number): GrimeSettings {
  if (difficulty >= 3) return { count: 5, radius: 0.06, dirt: 0.45 }
  if (difficulty >= 2) return { count: 4, radius: 0.07, dirt: 0.35 }
  return { count: 3, radius: 0.08, dirt: 0.25 }
}

// Picks `count` spot positions inside DECK_AREA, each at least MIN_SPOT_GAP from the others.
// `random` returns numbers in [0, 1) like Math.random. The game passes a real RNG; tests pass a seeded one.
export function pickGrimeSpots(count: number, random: () => number): Point[] {
  const { left, right, top, bottom } = DECK_AREA
  const spots: Point[] = []
  while (spots.length < count) {
    let spot: Point = { x: 0, y: 0 }
    for (let tries = 0; tries < MAX_TRIES; tries++) {
      spot = { x: left + random() * (right - left), y: top + random() * (bottom - top) }
      if (spots.every(other => Math.hypot(spot.x - other.x, spot.y - other.y) >= MIN_SPOT_GAP)) break
    }
    spots.push(spot) // if every try was too close, keep the last one so the game always gets `count` spots
  }
  return spots
}

// How much one mop stroke (from `from` to `to`) scrubs a spot: the stroke's length if it passes within
// `radius` of the spot, otherwise 0. So scrubbing means rubbing back and forth, not just touching.
// `aspect` is screen width / height: stretching x by it turns the 0..1 square back into the real screen
// shape, so the scrubbable area is the circle the player sees and stroke lengths are in screen heights.
export function rubAmount(spot: Point, from: Point, to: Point, aspect: number, radius: number): number {
  const [ax, ay] = [from.x * aspect, from.y]
  const [dx, dy] = [to.x * aspect - ax, to.y - ay]
  const [px, py] = [spot.x * aspect, spot.y]
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return 0 // holding still doesn't scrub
  // The point on the stroke closest to the spot's center.
  const t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
  const distance = Math.hypot(ax + t * dx - px, ay + t * dy - py)
  return distance <= radius ? Math.sqrt(lengthSquared) : 0
}
