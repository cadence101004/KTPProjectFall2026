// Shared hit judging for beat map minigames, so every rhythm game feels the same.

export const HIT_WINDOW = 0.16 // seconds either side of a hit that count as on time

export type PressResult = 'hit' | 'early' | 'late' | 'ignore'

// Judges a press against the next hit in a beat map.
// - 'hit': within HIT_WINDOW of the next hit.
// - 'early': before the window but in the run-up to the next hit (past the halfway point since the previous
//   hit, or since the clip started for the first hit). This fails the game.
// - 'late': after the next hit's window has closed. This fails the game.
// - 'ignore': too far before the next hit to be aimed at it (e.g. a double tap right after the last hit),
//   or there are no hits left.
export function judgePress(
  hits: number[],
  nextHit: number,
  pressTime: number,
  clipStart: number,
  window = HIT_WINDOW,
): PressResult {
  const hit = hits[nextHit]
  if (hit === undefined) return 'ignore'
  if (Math.abs(pressTime - hit) <= window) return 'hit'
  if (pressTime > hit) return 'late'
  const previous = nextHit > 0 ? hits[nextHit - 1] : clipStart
  return pressTime >= (previous + hit) / 2 ? 'early' : 'ignore'
}
