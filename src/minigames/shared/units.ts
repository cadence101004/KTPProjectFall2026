import type Phaser from 'phaser'

// The game was designed at 480x270 but is drawn in full HD (1920x1080, see src/engine/gameView.ts) so text
// and art stay sharp. Sizes given as fractions of the screen (height * 0.07) need nothing. Fixed sizes are
// written in "design pixels" and converted here: u(scene, 14) is 14 pixels at the 270-tall design size,
// which is 56 real pixels at 1080.
export const DESIGN_HEIGHT = 270

export function u(scene: Phaser.Scene, designPixels: number): number {
  return (designPixels * scene.scale.height) / DESIGN_HEIGHT
}
