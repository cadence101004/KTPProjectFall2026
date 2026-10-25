import type { MiniGame } from '../types/minigame'
import { FireCannonGame } from './fire_cannon'
import { PatchTheHullGame } from './patch_the_hull'

// Every playable minigame, keyed by meta.id. Each clip gets a fresh instance from its factory.
// Add yours here when it is ready, e.g. fire_cannon: () => new FireCannonGame(),
export const minigames: Record<string, () => MiniGame> = {
  fire_cannon: () => new FireCannonGame(),
  patch_the_hull: () => new PatchTheHullGame(),
}
