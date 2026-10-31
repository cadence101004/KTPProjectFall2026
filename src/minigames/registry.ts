import type { MiniGame } from '../types/minigame'
import { CannonballBarrageGame } from './cannonball_barrage'
import { CatchTheFruitGame } from './catch_the_fruit'
import { DodgeKrakenGame } from './dodge_kraken'
import { FireCannonGame } from './fire_cannon'
import { FlotsamHopGame } from './flotsam_hop'
import { ParryGame } from './parry'
import { ParrotSaysGame } from './parrot_says'
import { PatchTheHullGame } from './patch_the_hull'
import { SwabTheDeckGame } from './swab_the_deck'
import { XMarksTheSpotGame } from './x_marks_the_spot'

// Every playable minigame, keyed by meta.id. Each clip gets a fresh instance from its factory.
// Add yours here when it is ready, e.g. fire_cannon: () => new FireCannonGame(),
export const minigames: Record<string, () => MiniGame> = {
  cannonball_barrage: () => new CannonballBarrageGame(),
  catch_the_fruit: () => new CatchTheFruitGame(),
  dodge_kraken: () => new DodgeKrakenGame(),
  fire_cannon: () => new FireCannonGame(),
  flotsam_hop: () => new FlotsamHopGame(),
  parry: () => new ParryGame(),
  parrot_says: () => new ParrotSaysGame(),
  patch_the_hull: () => new PatchTheHullGame(),
  swab_the_deck: () => new SwabTheDeckGame(),
  x_marks_the_spot: () => new XMarksTheSpotGame(),
}
