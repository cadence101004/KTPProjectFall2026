import { describe, expect, it } from 'vitest'
import { findHookTip } from './hookTip'

// Builds a small RGBA image from a map of "x,y" -> [r, g, b, a]; everything else is transparent.
function image(width: number, height: number, pixels: Record<string, number[]>): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4)
  for (const [key, rgba] of Object.entries(pixels)) {
    const [x, y] = key.split(',').map(Number)
    data.set(rgba, (y * width + x) * 4)
  }
  return data
}

describe('findHookTip', () => {
  it('finds the leftmost gray pixel', () => {
    const data = image(5, 5, { '3,1': [120, 120, 120, 255], '2,3': [40, 40, 40, 255] })
    expect(findHookTip(data, 5, 5)).toEqual({ x: 2, y: 3 })
  })

  it('skips colored decorations like the red bow and sparkles', () => {
    const data = image(5, 5, { '0,0': [230, 60, 80, 255], '3,2': [100, 100, 100, 255] })
    expect(findHookTip(data, 5, 5)).toEqual({ x: 3, y: 2 })
  })

  it('skips see-through pixels', () => {
    const data = image(5, 5, { '0,0': [100, 100, 100, 50], '4,4': [100, 100, 100, 255] })
    expect(findHookTip(data, 5, 5)).toEqual({ x: 4, y: 4 })
  })
})
