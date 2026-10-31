import { describe, expect, it } from 'vitest'
import type { Clip } from '../types/level'
import { autoCountdownRate, countdownBeats, countdownNeeds, goLead, planCountdown, shortCountdownBuffers } from './countdown'

describe('shortCountdownBuffers', () => {
  const game = (start: number, end: number): Clip => ({ type: 'game', gameId: 'x', start, end, difficulty: 1 })
  const buffer = (start: number, end: number): Clip => ({ type: 'buffer', start, end })

  it('finds a buffer before a minigame that is too short for the countdown', () => {
    const clips = [buffer(0, 1.5), game(1.5, 5), buffer(5, 8), game(8, 12)]
    expect(shortCountdownBuffers(clips, 2.6)).toEqual([clips[0]])
  })

  it('skips buffers that do not lead into a minigame', () => {
    expect(shortCountdownBuffers([game(0, 4), buffer(4, 5)], 2.6)).toEqual([])
  })

  it('counts a buffer exactly the needed length as long enough', () => {
    expect(shortCountdownBuffers([buffer(0, 2.6), game(2.6, 5)], 2.6)).toEqual([])
  })
})

// A sound whose counts are 0.5 s apart, with GO at 1.6 s into the file.
const fileBeats = [0.1, 0.6, 1.1, 1.6]

describe('goLead', () => {
  it('is about a second, in whole beats', () => {
    expect(goLead(120)).toBe(1) // 2 beats of 0.5 s
    expect(goLead(90)).toBeCloseTo(4 / 3) // 1.5 beats rounds to 2 beats of 0.667 s
  })

  it('is never less than one beat', () => {
    expect(goLead(40)).toBe(1.5)
  })
})

describe('planCountdown', () => {
  it('lands GO on the given time, one beat per count at 120 BPM', () => {
    const cue = planCountdown(fileBeats, 10, 0, 120)
    expect(cue.rate).toBeCloseTo(1)
    expect(cue.beats.map(b => +b.toFixed(3))).toEqual([8.5, 9, 9.5, 10])
  })

  it('speeds up (and shortens) on a faster song', () => {
    const cue = planCountdown(fileBeats, 10, 0, 240)
    expect(cue.rate).toBeCloseTo(2)
    expect(cue.beats.map(b => +b.toFixed(3))).toEqual([9.25, 9.5, 9.75, 10])
  })

  it('uses the manual rate when the level sets one', () => {
    expect(planCountdown(fileBeats, 10, 0, 120, 1.5).rate).toBe(1.5)
  })

  it('starts partway into the sound when the buffer is too short, keeping GO on time', () => {
    const cue = planCountdown(fileBeats, 10, 9, 120)
    expect(cue.soundAt).toBe(9)
    expect(cue.fileOffset).toBeCloseTo(0.6)
    expect(cue.beats[3]).toBeCloseTo(10)
  })
})

describe('autoCountdownRate', () => {
  it('puts one count on each beat', () => {
    expect(autoCountdownRate(fileBeats, 120)).toBeCloseTo(1) // counts 0.5 s apart, beats 0.5 s apart
    expect(autoCountdownRate(fileBeats, 240)).toBeCloseTo(2)
  })
})

describe('countdownNeeds', () => {
  it('is the sound up to GO plus the breather', () => {
    expect(countdownNeeds(fileBeats, 120)).toBeCloseTo(1.6 + 1) // GO is 1.6 s in; the breather is 2 beats
  })

  it('gets shorter with a faster manual rate', () => {
    expect(countdownNeeds(fileBeats, 120, 2)).toBeCloseTo(0.8 + 1)
  })
})

describe('countdownBeats', () => {
  it('uses the first four detected counts', () => {
    expect(countdownBeats([0.1, 0.6, 1.1, 1.6, 1.9], 2)).toEqual([0.1, 0.6, 1.1, 1.6])
  })

  it('falls back to even quarters of the file', () => {
    expect(countdownBeats([0.1], 2)).toEqual([0, 0.5, 1, 1.5])
  })
})
