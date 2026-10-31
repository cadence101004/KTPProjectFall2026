import { describe, expect, it } from 'vitest'
import { fuseBurn, windowScaleFor } from './fuse'

describe('windowScaleFor', () => {
  it('narrows the judgement windows as difficulty rises', () => {
    expect(windowScaleFor(1)).toBe(1)
    expect(windowScaleFor(2)).toBe(0.8)
    expect(windowScaleFor(3)).toBe(0.65)
    expect(windowScaleFor(5)).toBe(0.65)
  })
})

// 120 BPM: a beat is 0.5 s, so a full 2-beat fuse burns for 1 s. The clip starts at 10 s.
const beat = 0.5

describe('fuseBurn', () => {
  it('burns a full fuse over the 2 beats before its shot', () => {
    const hits = [12]
    expect(fuseBurn(hits, 0, 11, 10, beat)).toBe(0) // lit 2 beats early
    expect(fuseBurn(hits, 0, 11.5, 10, beat)).toBe(0.5)
    expect(fuseBurn(hits, 0, 12, 10, beat)).toBe(1) // reaches the mark on the hit
  })

  it('stays unlit before its fuse starts and full after the hit', () => {
    expect(fuseBurn([12], 0, 10.5, 10, beat)).toBe(0)
    expect(fuseBurn([12], 0, 12.3, 10, beat)).toBe(1)
  })

  it('gives a shot right after the previous one a shorter fuse', () => {
    const hits = [11, 11.25] // an offbeat a quarter second after the last shot
    expect(fuseBurn(hits, 1, 11, 10, beat)).toBe(0) // lit at the previous shot
    expect(fuseBurn(hits, 1, 11.125, 10, beat)).toBeCloseTo(0.5)
  })

  it('never lights the first fuse before the clip starts', () => {
    expect(fuseBurn([10.5], 0, 10, 10, beat)).toBe(0) // lit at the clip start, not 1 s before it
    expect(fuseBurn([10.5], 0, 10.25, 10, beat)).toBeCloseTo(0.5)
  })

  it('reads as fully burned once every shot is done', () => {
    expect(fuseBurn([11], 1, 11.5, 10, beat)).toBe(1)
  })
})
