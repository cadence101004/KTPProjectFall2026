// Pure fuse logic for Fire the Cannon. No Phaser in here, so it can be tested with plain Vitest.
import { HIT_WINDOW } from '../shared/judgePress'

// The hit window shrinks as difficulty rises: the full shared window at 1, then 80% and 65%.
export function hitWindowFor(difficulty: number): number {
  const scale = difficulty >= 3 ? 0.65 : difficulty >= 2 ? 0.8 : 1
  return HIT_WINDOW * scale
}

// How long a fuse burns before its shot, in beats. Hits closer together than this get shorter fuses.
export const FUSE_BEATS = 2

// How far the fuse for the next shot has burned, from 0 (just lit) to 1 (the spark reaches the mark,
// exactly on the hit). A fuse is lit FUSE_BEATS before its hit, but never before the previous shot (or
// the clip start, for the first shot), so back-to-back offbeat hits still get their own short fuse.
export function fuseBurn(hits: number[], next: number, songTime: number, clipStart: number, beatLength: number): number {
  const hit = hits[next]
  if (hit === undefined) return 1 // no shots left
  const previous = next > 0 ? hits[next - 1] : clipStart
  const litAt = Math.max(previous, hit - FUSE_BEATS * beatLength)
  if (hit <= litAt) return 1
  return Math.min(1, Math.max(0, (songTime - litAt) / (hit - litAt)))
}
