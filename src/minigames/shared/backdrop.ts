// Cadence's painted backgrounds, shared by any minigame whose background layer is scenery. A game loads the
// ones it uses in preload and draws one first thing in start, inside its `if (params.background)`.
import type Phaser from 'phaser'

export type Backdrop = 'island' | 'deck' | 'ocean'

const FILES: Record<Backdrop, string> = {
  island: '/assets/sprites/backgrounds/IslandBackground.png', // a beach with palm trees and sea
  deck: '/assets/sprites/backgrounds/ShipDeckBackground.png', // a ship's deck with railings, a barrel and crates
  ocean: '/assets/sprites/backgrounds/OceanShipBackground.png', // open sea under a pink sky, a ship on the right
}

// Shared texture key (one copy for every game that uses it; the loader skips a key already queued).
const keyFor = (backdrop: Backdrop): string => `shared_backdrop_${backdrop}`

export function loadBackdrop(load: Phaser.Loader.LoaderPlugin, backdrop: Backdrop): void {
  load.image(keyFor(backdrop), FILES[backdrop])
}

// Draws the backdrop covering the whole screen, like CSS background-size: cover. On a screen shape wider or
// taller than the picture the overflow is cropped evenly, so nothing is ever stretched or letterboxed.
export function addBackdrop(scene: Phaser.Scene, backdrop: Backdrop): Phaser.GameObjects.Image {
  const { width, height } = scene.scale
  const image = scene.add.image(width / 2, height / 2, keyFor(backdrop))
  return image.setScale(Math.max(width / image.width, height / image.height))
}
