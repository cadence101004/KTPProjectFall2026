import { describe, expect, it } from 'vitest'
import { buttonForKey } from './input'

describe('buttonForKey', () => {
  it('maps arrows and WASD to directions', () => {
    expect(buttonForKey('ArrowLeft')).toBe('left')
    expect(buttonForKey('KeyD')).toBe('right')
  })

  it('maps Space and Enter to action', () => {
    expect(buttonForKey('Space')).toBe('action')
    expect(buttonForKey('Enter')).toBe('action')
  })

  it('ignores unmapped keys', () => {
    expect(buttonForKey('KeyQ')).toBeNull()
  })
})
