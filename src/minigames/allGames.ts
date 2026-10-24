import type { MiniGame, MiniGameMeta } from '../types/minigame'
import { TemplateDurationGame } from './_template_duration'
import { TemplateTaskGame } from './_template_task'
import { minigames } from './registry'

// Everything the sandbox and editor can use: the two templates plus every registered minigame.
export const allGames: Record<string, () => MiniGame> = {
  template_task: () => new TemplateTaskGame(),
  template_duration: () => new TemplateDurationGame(),
  ...minigames,
}

// Metadata for a game ID, or null if no such game exists.
export function metaFor(id: string): MiniGameMeta | null {
  return allGames[id]?.().meta ?? null
}
