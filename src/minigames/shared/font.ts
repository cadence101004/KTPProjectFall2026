import type Phaser from 'phaser'

// The game's font (Pixelify Sans, served from public/fonts via @font-face in src/style.css), with fallbacks.
export const GAME_FONT = '"Pixelify Sans", system-ui, sans-serif'

// A Phaser text style in the game font. Phaser draws text onto a canvas, where page CSS doesn't reach,
// so every text object needs the font named: scene.add.text(x, y, 'FIRE!', textStyle(24, { color: '#fff' })).
export function textStyle(
  size: number,
  extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: GAME_FONT, fontSize: `${size}px`, ...extra }
}

// Waits for the font to load before Phaser starts, so the first text isn't stuck in a fallback font.
// Gives up after 2 seconds (e.g. the file is missing) and carries on with the fallback.
export async function loadGameFont(): Promise<void> {
  const fonts = Promise.all([
    document.fonts.load('16px "Pixelify Sans"'),
    document.fonts.load('bold 16px "Pixelify Sans"'),
  ])
  await Promise.race([fonts.catch(() => undefined), new Promise(resolve => setTimeout(resolve, 2000))])
}
