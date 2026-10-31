import { describe, expect, it } from 'vitest'
import type { MediaClip } from '../types/level'
import { cutMedia, trimMedia } from './mediaEditing'

const video: MediaClip = {
  kind: 'video',
  src: 'intro.mp4',
  mediaHash: 'abc',
  start: 10,
  end: 20,
  mediaOffset: 3,
  effects: { blur: 8, dim: 0.4 },
}

describe('trimMedia', () => {
  // `video` starts at song time 10, 3 s into its file, and ends at 20.

  it('moves the end edge', () => {
    expect(trimMedia(video, 'end', 16).end).toBe(16)
  })

  it('keeps the video in place when trimming the start later', () => {
    const trimmed = trimMedia(video, 'start', 12)
    expect(trimmed.start).toBe(12)
    expect(trimmed.mediaOffset).toBe(5) // 2 s further into the file, so the same scene plays at song time 12
  })

  it('reveals earlier footage when dragging the start back, down to the file start', () => {
    expect(trimMedia(video, 'start', 8).mediaOffset).toBe(1)
    const atFileStart = trimMedia(video, 'start', 2) // would need 5 s before the file began
    expect(atFileStart.start).toBe(7)
    expect(atFileStart.mediaOffset).toBe(0)
  })

  it('never makes a clip shorter than the minimum piece', () => {
    expect(trimMedia(video, 'end', 9).end).toBeCloseTo(10.25)
    expect(trimMedia(video, 'start', 25).start).toBeCloseTo(19.75)
  })

  it('lets an image start anywhere', () => {
    const image = { ...video, kind: 'image' as const, mediaOffset: 0 }
    expect(trimMedia(image, 'start', 2).start).toBe(2)
  })
})

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
