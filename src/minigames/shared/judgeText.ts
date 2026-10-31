import type Phaser from 'phaser'
import { loadShowOffsets } from '../../settings/timing'
import { textStyle } from './font'
import type { Grade } from './judgePress'

const LABELS: Record<Grade | 'miss', { text: string; color: string }> = {
  perfect: { text: 'PERFECT!', color: '#ffe066' },
  great: { text: 'GREAT', color: '#7dffb0' },
  good: { text: 'GOOD', color: '#7dc8ff' },
  miss: { text: 'MISS', color: '#ff6b6b' },
}

// Pops up a judgement ("PERFECT!", "GREAT", "GOOD", or "MISS") at (x, y) that floats up and fades.
// With "show ms in game" on (Timing Calibration page), it also shows how early (-) or late (+) the press
// was. Purely decoration, so a Phaser tween animates it. Add the returned text to your minigame's objects
// so destroy() removes it if the clip ends mid-animation.
export function showJudgement(
  scene: Phaser.Scene,
  grade: Grade | 'miss',
  offset: number | null,
  x: number,
  y: number,
): Phaser.GameObjects.Text {
  const { text, color } = LABELS[grade]
  const ms = offset === null ? '' : `${offset >= 0 ? '+' : ''}${Math.round(offset * 1000)} ms`
  const label = loadShowOffsets() && ms ? `${text}\n${ms}` : text
  const popup = scene.add
    .text(x, y, label, textStyle(Math.round(scene.scale.height * 0.06), { color, fontStyle: 'bold', align: 'center' }))
    .setOrigin(0.5)
    .setDepth(500)
  scene.tweens.add({
    targets: popup,
    y: y - scene.scale.height * 0.08,
    alpha: 0,
    duration: 600,
    ease: 'Cubic.easeOut',
    onComplete: () => popup.destroy(),
  })
  return popup
}
