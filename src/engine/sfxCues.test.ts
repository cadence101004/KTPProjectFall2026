import { describe, expect, it } from 'vitest'
import type { SfxCue } from '../types/level'
import { dueCues, SFX_LOOKAHEAD } from './sfxCues'

const cue = (at: number, soundHash = 'boom'): SfxCue => ({ name: 'boom.mp3', soundHash, at, volume: 1 })
const lengths: Record<string, number> = { boom: 1 } // seconds
const duration = (hash: string) => lengths[hash]

describe('dueCues', () => {
  const cues = [cue(2), cue(5), cue(5 + SFX_LOOKAHEAD + 0.1)]

  it('schedules cues starting within the lookahead', () => {
    expect(dueCues(cues, new Set(), 4.9, duration)).toEqual([1])
  })

  it('never schedules a cue twice', () => {
    expect(dueCues(cues, new Set([1]), 4.9, duration)).toEqual([])
  })

  it('joins a cue partway when playback starts in the middle of it', () => {
    expect(dueCues(cues, new Set(), 2.5, duration)).toEqual([0])
  })

  it('skips cues that have already finished', () => {
    expect(dueCues(cues, new Set(), 3.5, duration)).toEqual([])
  })

  it('skips cues whose sound file is missing', () => {
    expect(dueCues([cue(5, 'lost')], new Set(), 4.9, duration)).toEqual([])
  })
})
