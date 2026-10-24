import type { MiniGame } from '../types/minigame'

// Every playable minigame, keyed by meta.id. Each clip gets a fresh instance from its factory.
// Add yours here when it is ready, e.g. fire_cannon: () => new FireCannonGame(),
export const minigames: Record<string, () => MiniGame> = {}
