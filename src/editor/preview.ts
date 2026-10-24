import { clipIndexAt } from '../engine/LevelRunner'
import type { Clip } from '../types/level'

// Where a preview from the playhead should begin. Inside a minigame clip it backs up to that clip's start,
// because joining a minigame halfway would fail its missed task windows instantly.
export function previewStart(clips: Clip[], playhead: number): number {
  const clip = clips[clipIndexAt(clips, playhead)]
  return clip?.type === 'game' ? clip.start : playhead
}
