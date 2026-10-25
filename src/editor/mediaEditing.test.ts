import { describe, expect, it } from 'vitest'
import type { MediaClip } from '../types/level'
import { cutMedia } from './mediaEditing'

const video: MediaClip = {
  kind: 'video',
  src: 'intro.mp4',
  mediaHash: 'abc',
  start: 10,
  end: 20,
  mediaOffset: 3,
  effects: { blur: 8, dim: 0.4 },
}

describe('cutMedia', () => {
  it('splits a clip at the cut point', () => {
    const [before, after] = cutMedia(video, 14)!
    expect([before.start, before.end]).toEqual([10, 14])
    expect([after.start, after.end]).toEqual([14, 20])
  })

  it('keeps the video continuous across the cut', () => {
    const [before, after] = cutMedia(video, 14)!
    expect(before.mediaOffset).toBe(3)
    expect(after.mediaOffset).toBe(7) // 3 s into the file + 4 s into the clip
  })

  it('gives each piece its own effects', () => {
    const [before, after] = cutMedia(video, 14)!
    after.effects.blur = 0
    expect(before.effects.blur).toBe(8)
    expect(video.effects.blur).toBe(8)
  })

  it('refuses a cut too close to either edge or outside the clip', () => {
    expect(cutMedia(video, 10.1)).toBeNull()
    expect(cutMedia(video, 19.9)).toBeNull()
    expect(cutMedia(video, 25)).toBeNull()
  })

  it('leaves an image offset alone', () => {
    const [, after] = cutMedia({ ...video, kind: 'image', mediaOffset: 0 }, 14)!
    expect(after.mediaOffset).toBe(0)
  })
})
