import { TemplateDurationGame } from '../minigames/_template_duration'
import { TemplateTaskGame } from '../minigames/_template_task'
import { minigames } from '../minigames/registry'
import type { MiniGame } from '../types/minigame'

// Everything the sandbox can play: the two templates plus every registered minigame.
export const sandboxGames: Record<string, () => MiniGame> = {
  template_task: () => new TemplateTaskGame(),
  template_duration: () => new TemplateDurationGame(),
  ...minigames,
}
