import { describe, expect, it } from 'vitest'
import { hashFile } from './hash'

describe('hashFile', () => {
  it('matches the standard SHA-256 of "abc"', async () => {
    expect(await hashFile(new Blob(['abc']))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('gives different files different hashes', async () => {
    expect(await hashFile(new Blob(['a']))).not.toBe(await hashFile(new Blob(['b'])))
  })
})
