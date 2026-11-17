import { strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { hashFile } from '../audio/hash'
import type { Level } from '../types/level'
import { buildPack, packFileName, type PackFile, readPack, withoutOverlaps } from './pack'

const bytes = (text: string) => strToU8(text)
const hashOf = (data: Uint8Array) => hashFile(new Blob([data as BlobPart]))

// A level using one song, one video, and one sound, with the matching files.
async function sample(): Promise<{ level: Level; song: PackFile; video: PackFile; boom: PackFile }> {
  const song = { name: 'shanty.mp3', bytes: bytes('pretend mp3') }
  const video = { name: 'waves.mp4', bytes: bytes('pretend mp4') }
  const boom = { name: 'boom.wav', bytes: bytes('pretend wav') }
  const level: Level = {
    title: "Kraken's Lullaby",
    audioHash: await hashOf(song.bytes),
    bpm: 128,
    beatOffset: 0,
    clips: [
      { type: 'buffer', start: 0, end: 4 },
      { type: 'game', gameId: 'fire_cannon', start: 4, end: 8, difficulty: 1 },
    ],
    media: [{ kind: 'video', src: 'waves.mp4', mediaHash: await hashOf(video.bytes), start: 0, end: 8, mediaOffset: 0, effects: { blur: 8, dim: 0.4 } }],
    sfx: [{ name: 'boom.wav', soundHash: await hashOf(boom.bytes), at: 4, volume: 0.8 }],
  }
  return { level, song, video, boom }
}

async function samplePack(withSong = true) {
  const { level, song, video, boom } = await sample()
  const packed = buildPack({
    level,
    song: withSong ? song : null,
    media: new Map([[level.media[0].mediaHash, video]]),
    sounds: new Map([[level.sfx[0].soundHash, boom]]),
  })
  return { packed, level }
}

describe('buildPack and readPack', () => {
  it('round-trips a level with its song, media, and sounds', async () => {
    const { packed, level } = await samplePack()
    const pack = await readPack(packed)
    expect(pack.level).toEqual(level)
    expect(pack.song?.name).toBe('shanty.mp3')
    expect(pack.media.get(level.media[0].mediaHash)?.name).toBe('waves.mp4')
    expect(pack.sounds.get(level.sfx[0].soundHash)?.name).toBe('boom.wav')
    expect(pack.warnings).toEqual([])
  })

  it('lays the zip out as documented, naming files by hash', async () => {
    const { packed, level } = await samplePack()
    expect(Object.keys(unzipSync(packed)).sort()).toEqual([
      'audio/song.mp3',
      'level.json',
      'manifest.json',
      `media/${level.media[0].mediaHash}.mp4`,
      `sfx/${level.sfx[0].soundHash}.wav`,
    ])
  })

  it('opens a pack without its song', async () => {
    const pack = await readPack((await samplePack(false)).packed)
    expect(pack.song).toBeNull()
    expect(pack.level.audioHash).not.toBe('')
  })

  it('leaves out a damaged file, with a warning', async () => {
    const files = unzipSync((await samplePack()).packed)
    const videoPath = Object.keys(files).find(path => path.startsWith('media/'))!
    files[videoPath] = bytes('tampered')
    const pack = await readPack(zipSync(files))
    expect(pack.media.size).toBe(0)
    expect(pack.warnings).toEqual(['waves.mp4 is damaged, so it was left out.'])
  })

  it('leaves out a song that is not the one the level was made with', async () => {
    const files = unzipSync((await samplePack()).packed)
    files['audio/song.mp3'] = bytes('some other song')
    const pack = await readPack(zipSync(files))
    expect(pack.song).toBeNull()
    expect(pack.warnings).toHaveLength(1)
  })

  it('removes overlapping clips, with a warning', async () => {
    const { level } = await sample()
    level.clips.push({ type: 'buffer', start: 6, end: 9 }) // overlaps the game clip
    const pack = await readPack(buildPack({ level, song: null, media: new Map(), sounds: new Map() }))
    expect(pack.level.clips).toHaveLength(2)
    expect(pack.warnings).toEqual(['1 overlapping clip(s) were removed.'])
  })

  it('refuses things that are not packs', async () => {
    await expect(readPack(bytes('just some text'))).rejects.toThrow('not a PirateWare level pack')
    await expect(readPack(zipSync({ 'notes.txt': bytes('hi') }))).rejects.toThrow('not a PirateWare level pack')
  })

  it('refuses packs from a newer version of the game', async () => {
    const files = unzipSync((await samplePack()).packed)
    files['manifest.json'] = bytes(JSON.stringify({ format: 99, title: 'Future', hasAudio: false, names: {} }))
    await expect(readPack(zipSync(files))).rejects.toThrow('newer version')
  })
})

describe('withoutOverlaps', () => {
  it('keeps clips that touch end to start', () => {
    const clips = [
      { type: 'buffer' as const, start: 0, end: 2 },
      { type: 'buffer' as const, start: 2, end: 4 },
    ]
    expect(withoutOverlaps(clips)).toEqual(clips)
  })
})

describe('packFileName', () => {
  it('makes a safe file name from the title', () => {
    expect(packFileName("Kraken's Lullaby")).toBe('krakens-lullaby.pwlevel')
    expect(packFileName('!!!')).toBe('level.pwlevel')
  })
})
