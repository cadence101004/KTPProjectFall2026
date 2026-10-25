import Phaser from 'phaser'
import type { AudioClock } from '../audio/AudioClock'
import { findOnsets } from '../audio/onsets'
import { loadGameFont } from '../minigames/shared/font'
import { countdownBeats } from './countdown'
import type { LevelScene } from './LevelScene'

// Setup shared by every page that shows the game: the Play page, the editor preview, and the sandbox.

// Starts Phaser in the element with id `parent`, running `scene`, at the game's 480x270 pixel-art size
// scaled to fit. Waits for the game font first so text never gets stuck in a fallback font.
export async function createGameView(parent: string, scene: Phaser.Scene): Promise<Phaser.Game> {
  await loadGameFont()
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 480,
    height: 270,
    transparent: true, // so the media track behind the canvas shows through; the stage's CSS color is the default background
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene],
  })
}

// Loads the 321GO sound into a LevelScene, finding its four counts so the countdown lines up with the beat.
// If it fails, buffers just play without a countdown.
export async function loadCountdownSound(clock: AudioClock, scene: LevelScene): Promise<void> {
  try {
    const buffer = await clock.loadSfx('/assets/audio/321GO_sfx.mp3')
    const beats = countdownBeats(findOnsets(buffer.getChannelData(0), buffer.sampleRate), buffer.duration)
    scene.setCountdownSound({ buffer, beats })
  } catch {
    console.warn('Could not load the 321GO sound; buffers will play without a countdown.')
  }
}
