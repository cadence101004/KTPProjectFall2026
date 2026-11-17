// Level packs (.pwlevel): a level and its files in one zip, so it can be shared as a single file.
// This module only turns bytes into a pack and back (no IndexedDB, no DOM), so it's tested directly.
//
//   manifest.json      { format, title, hasAudio, names: { "<path>": "original file name" } }
//   level.json         the level (src/types/level.ts)
//   audio/song.<ext>   optional: the song (the player can bring their own; audioHash checks it)
//   media/<hash>.<ext> background images and videos, named by their SHA-256 so names never collide
//   sfx/<hash>.<ext>   sound effects, the same way
//
// A pack is data, never code: only these paths are read, and every file is checked against its hash.
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import { hashFile } from '../audio/hash'
import { normalizeLevel } from '../storage/levelFormat'
import type { Clip, Level } from '../types/level'

export const PACK_FORMAT = 1
export const PACK_EXTENSION = '.pwlevel'
const MAX_FILE_BYTES = 512 * 1024 * 1024 // one file inside a pack, unpacked (a long HD video fits)
const MAX_JSON_BYTES = 4 * 1024 * 1024 // manifest.json and level.json

// One file going into or coming out of a pack.
export interface PackFile {
  name: string // the original file name, for the editor and the "needs its song" prompts
  bytes: Uint8Array
}

export interface PackContents {
  level: Level
  song: PackFile | null // null when the pack was exported without its song
  media: Map<string, PackFile> // by mediaHash
  sounds: Map<string, PackFile> // by soundHash
}

interface Manifest {
  format: number
  title: string
  hasAudio: boolean
  names: Record<string, string>
}

// The file's extension (".mp3"), or "" if it has none. Only letters and digits, so a name can't smuggle
// a path into the zip.
function extensionOf(name: string): string {
  const match = /\.([a-z0-9]{1,8})$/i.exec(name)
  return match ? `.${match[1].toLowerCase()}` : ''
}

// Builds the pack's zip bytes. Songs, videos, and images are already compressed, so they're stored as-is
// (fast, and no bigger); only the JSON is deflated.
export function buildPack(contents: PackContents): Uint8Array {
  const { level, song, media, sounds } = contents
  const files: Zippable = {}
  const names: Record<string, string> = {}
  const add = (path: string, file: PackFile) => {
    files[path] = [file.bytes, { level: 0 }]
    names[path] = file.name
  }
  if (song) add(`audio/song${extensionOf(song.name) || '.mp3'}`, song)
  for (const [hash, file] of media) add(`media/${hash}${extensionOf(file.name)}`, file)
  for (const [hash, file] of sounds) add(`sfx/${hash}${extensionOf(file.name)}`, file)
  const manifest: Manifest = { format: PACK_FORMAT, title: level.title, hasAudio: song !== null, names }
  files['manifest.json'] = [strToU8(JSON.stringify(manifest, null, 2)), { level: 6 }]
  files['level.json'] = [strToU8(JSON.stringify(level, null, 2)), { level: 6 }]
  return zipSync(files)
}

// Opens a pack and checks everything in it. Throws (with a message to show) if it isn't a usable pack;
// smaller problems are returned as warnings and the bad parts are left out, so the level still loads.
export async function readPack(bytes: Uint8Array): Promise<PackContents & { warnings: string[] }> {
  let files: Record<string, Uint8Array>
  try {
    // The size check runs before anything is unpacked, so a booby-trapped zip can't fill the memory.
    files = unzipSync(bytes, { filter: file => file.originalSize <= MAX_FILE_BYTES })
  } catch {
    throw new Error('This file is not a PirateWare level pack.')
  }
  const manifest = parseJson(files['manifest.json']) as Partial<Manifest> | null
  if (!manifest || typeof manifest.format !== 'number') throw new Error('This file is not a PirateWare level pack.')
  if (manifest.format > PACK_FORMAT) {
    throw new Error('This pack was made with a newer version of PirateWare. Update the game to open it.')
  }
  let level: Level
  try {
    level = normalizeLevel(parseJson(files['level.json']))
  } catch {
    throw new Error('This pack has no readable level in it.')
  }

  const warnings: string[] = []
  const names = typeof manifest.names === 'object' && manifest.names ? manifest.names : {}
  const nameOf = (path: string) => (typeof names[path] === 'string' ? names[path] : path.split('/').pop()!)

  // The song: any audio/song.* file. Checked against the level's audioHash.
  let song: PackFile | null = null
  const songPath = Object.keys(files).find(path => /^audio\/song(\.[a-z0-9]+)?$/i.test(path))
  if (songPath) {
    const file = { name: nameOf(songPath), bytes: files[songPath] }
    if (!level.audioHash || (await hashOf(file.bytes)) === level.audioHash) song = file
    else warnings.push('The song in this pack is not the file the level was made with, so it was left out.')
  }

  // Media and sound files: each must be named by its own hash, and be one the level actually uses.
  const media = await filesIn(files, 'media/', new Set(level.media.map(clip => clip.mediaHash)), nameOf, warnings)
  const sounds = await filesIn(files, 'sfx/', new Set(level.sfx.map(cue => cue.soundHash)), nameOf, warnings)

  const kept = withoutOverlaps(level.clips)
  if (kept.length < level.clips.length) {
    warnings.push(`${level.clips.length - kept.length} overlapping clip(s) were removed.`)
    level.clips = kept
  }
  return { level, song, media, sounds, warnings }
}

// Every file under `folder` whose name is its own SHA-256 and that the level uses, by hash. Anything else
// (a damaged file, or one the level doesn't need) is skipped, with a warning for damaged ones.
async function filesIn(
  files: Record<string, Uint8Array>,
  folder: string,
  wanted: Set<string>,
  nameOf: (path: string) => string,
  warnings: string[],
): Promise<Map<string, PackFile>> {
  const found = new Map<string, PackFile>()
  for (const [path, bytes] of Object.entries(files)) {
    if (!path.startsWith(folder)) continue
    const hash = path.slice(folder.length).replace(/\.[a-z0-9]+$/i, '')
    if (!wanted.has(hash)) continue
    if ((await hashOf(bytes)) !== hash) {
      warnings.push(`${nameOf(path)} is damaged, so it was left out.`)
      continue
    }
    found.set(hash, { name: nameOf(path), bytes })
  }
  return found
}

// The game track's clips with any that overlap an earlier one dropped (clips must never overlap). The
// clips are already sorted by start time.
export function withoutOverlaps(clips: Clip[]): Clip[] {
  const kept: Clip[] = []
  for (const clip of clips) {
    const last = kept[kept.length - 1]
    if (!last || clip.start >= last.end - 1e-6) kept.push(clip)
  }
  return kept
}

// A file name for the pack, from the level's title: "Kraken's Lullaby" becomes "krakens-lullaby.pwlevel".
export function packFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'level'}${PACK_EXTENSION}`
}

function parseJson(bytes: Uint8Array | undefined): unknown {
  if (!bytes || bytes.length > MAX_JSON_BYTES) return null
  try {
    return JSON.parse(strFromU8(bytes))
  } catch {
    return null
  }
}

function hashOf(bytes: Uint8Array): Promise<string> {
  return hashFile(new Blob([bytes as BlobPart]))
}
