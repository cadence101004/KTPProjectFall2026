import type { MiniGame } from '../types/minigame'
import { CatchTheFruitGame } from './catch_the_fruit'
import { DodgeKrakenGame } from './dodge_kraken'
import { FireCannonGame } from './fire_cannon'
import { PatchTheHullGame } from './patch_the_hull'
import { SwabTheDeckGame } from './swab_the_deck'

// Every playable minigame, keyed by meta.id. Each clip gets a fresh instance from its factory.
// Add yours here when it is ready, e.g. fire_cannon: () => new FireCannonGame(),
export const minigames: Record<string, () => MiniGame> = {
  catch_the_fruit: () => new CatchTheFruitGame(),
  dodge_kraken: () => new DodgeKrakenGame(),
  fire_cannon: () => new FireCannonGame(),
  patch_the_hull: () => new PatchTheHullGame(),
  swab_the_deck: () => new SwabTheDeckGame(),
}
