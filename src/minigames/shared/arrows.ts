// Arrow-direction helpers shared by the rhythm games where you press a direction (Parry!, Parrot Says):
// the four directions, drawing an arrow, and grading a press that needs both the right arrow and timing.
import type Phaser from 'phaser'
import type { GameButton, HitGrade } from '../../types/minigame'
import type { Judgement } from './judgePress'

export type Direction = 'up' | 'down' | 'left' | 'right'
export const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right']

// The angle to rotate a right-pointing arrow (as drawn by addArrow) to point each way.
export const ARROW_ANGLES: Record<Direction, number> = { right: 0, down: 90, left: 180, up: 270 }

// Draws a right-pointing arrow centered at (x, y), `size` from its middle to its tip. Rotate it with
// setAngle(ARROW_ANGLES[direction]). Phaser measures a triangle's size from (0, 0), so the points stay
// positive to keep the arrow centered and spinning about its middle.
export function addArrow(scene: Phaser.Scene, x: number, y: number, size: number, color: number): Phaser.GameObjects.Triangle {
  const span = size * 2
  return scene.add.triangle(x, y, 0, 0, 0, span, span, size, color)
}

// The grade for a direction press: the timing grade if the right arrow was pressed in the window, or a miss
// for the wrong arrow or bad timing. Null when the press doesn't count either way (too far before the next
// hit to be aimed at it).
export function directionGrade(judgement: Judgement, pressed: GameButton, expected: Direction): HitGrade | null {
  if (judgement.result === 'ignore') return null
  if (judgement.result === 'hit' && pressed === expected) return judgement.grade
  return 'miss'
}
