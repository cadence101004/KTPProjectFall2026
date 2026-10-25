import { describe, expect, it } from 'vitest'
import type { MediaClip } from '../types/level'
import { mediaAt, videoTimeAt } from './MediaLayer'

const clip = (start: number, end: number, mediaHash = 'a', mediaOffset = 0): MediaClip => ({
  kind: 'video',
  src: 'intro.mp4',
  mediaHash,
  start,
  end,
  mediaOffset,
  effects: { blur: 8, dim: 0.4 },
})

describe('videoTimeAt', () => {
  it('starts the video at the clip start, plus its offset', () => {
    expect(videoTimeAt(clip(10, 20), 12)).toBe(2)
    expect(videoTimeAt(clip(10, 20, 'a', 5), 12)).toBe(7)
  })
})

describe('mediaAt', () => {
  const loaded = (hash: string) => hash !== 'missing'

  it('finds the media clip playing at a time', () => {
    const clips = [clip(0, 8), clip(8, 16, 'b')]
    expect(mediaAt(clips, 9, loaded)?.mediaHash).toBe('b')
  })

  it('shows nothing outside every clip', () => {
    expect(mediaAt([clip(0, 8)], 8, loaded)).toBeNull()
  })

  it('skips a clip whose file is missing, so the default background shows', () => {
    expect(mediaAt([clip(0, 8, 'missing')], 4, loaded)).toBeNull()
  })
})
