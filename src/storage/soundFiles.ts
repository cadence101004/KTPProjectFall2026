import type { SfxCue } from '../types/level'
import { loadSound } from './db'

// Loads and decodes every stored sound a level's SFX track uses, keyed by soundHash, for LevelScene.setSounds.
// A file that isn't stored in this browser, or won't decode, is left out: its cues stay silent and the
// level still plays.
export async function loadSoundBuffers(
  cues: SfxCue[],
  decode: (file: Blob) => Promise<AudioBuffer>,
): Promise<Map<string, AudioBuffer>> {
  const buffers = new Map<string, AudioBuffer>()
  for (const hash of new Set(cues.map(cue => cue.soundHash))) {
    const stored = await loadSound(hash)
    if (!stored) continue
    try {
      buffers.set(hash, await decode(stored.file))
    } catch {
      // not a playable audio file: skip it
    }
  }
  return buffers
}
