// Moves level packs in and out of this browser: exporting builds a .pwlevel from a level and its files and
// downloads it; importing checks a pack (readPack), stores its files, and saves the level as a new entry.
import { hashFile } from '../audio/hash'
import { metaFor } from '../minigames/allGames'
import { saveLevel, saveMedia, saveSong, saveSound } from '../storage/db'
import type { Level } from '../types/level'
import { buildPack, packFileName, type PackFile, readPack } from './pack'

// A file as the pages hold it: its name and its contents.
export interface NamedFile {
  name: string
  file: Blob
}

// What the browser should treat each kind of file as, so videos and sounds play straight from storage.
const TYPES: Record<string, string> = {
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
}

function blobOf(file: PackFile): Blob {
  const extension = /\.([a-z0-9]+)$/i.exec(file.name)?.[1].toLowerCase() ?? ''
  return new Blob([file.bytes as BlobPart], { type: TYPES[extension] ?? '' })
}

async function packFileOf(file: NamedFile): Promise<PackFile> {
  return { name: file.name, bytes: new Uint8Array(await file.file.arrayBuffer()) }
}

// Builds a level's pack and hands it to the browser as a download (e.g. krakens-lullaby.pwlevel). Files the
// level uses but that aren't given (not in this browser) are left out; returns how many were missing.
export async function exportPack(
  level: Level,
  song: NamedFile | null,
  media: Map<string, NamedFile>,
  sounds: Map<string, NamedFile>,
): Promise<{ missing: number }> {
  const pick = async (hashes: string[], from: Map<string, NamedFile>) => {
    const picked = new Map<string, PackFile>()
    for (const hash of new Set(hashes)) {
      const file = from.get(hash)
      if (file) picked.set(hash, await packFileOf(file))
    }
    return picked
  }
  const packMedia = await pick(level.media.map(clip => clip.mediaHash), media)
  const packSounds = await pick(level.sfx.map(cue => cue.soundHash), sounds)
  const missing =
    new Set(level.media.map(clip => clip.mediaHash)).size - packMedia.size + new Set(level.sfx.map(cue => cue.soundHash)).size - packSounds.size
  const zip = buildPack({ level, song: song ? await packFileOf(song) : null, media: packMedia, sounds: packSounds })
  download(new Blob([zip as BlobPart], { type: 'application/zip' }), packFileName(level.title))
  return { missing }
}

// Opens a .pwlevel, stores its song, media, and sounds in this browser, and saves its level as a new entry.
// Throws with a message to show if the file isn't a usable pack; smaller problems come back as warnings.
export async function importPack(file: Blob): Promise<{ id: string; level: Level; warnings: string[] }> {
  const pack = await readPack(new Uint8Array(await file.arrayBuffer()))
  const { level, warnings } = pack
  if (pack.song) {
    level.audioHash ||= await hashFile(blobOf(pack.song))
    await saveSong(level.audioHash, pack.song.name, blobOf(pack.song))
  }
  for (const [hash, media] of pack.media) await saveMedia(hash, media.name, blobOf(media))
  for (const [hash, sound] of pack.sounds) await saveSound(hash, sound.name, blobOf(sound))

  const unknown = [...new Set(level.clips.flatMap(clip => (clip.type === 'game' && !metaFor(clip.gameId) ? [clip.gameId] : [])))]
  if (unknown.length) warnings.push(`This copy of PirateWare doesn't have: ${unknown.join(', ')}. Those clips will show a notice.`)

  const id = crypto.randomUUID()
  await saveLevel(id, level)
  return { id, level, warnings }
}

// Whether a dropped or picked file looks like a level pack (by name; readPack checks the contents).
export function isPackFile(file: File): boolean {
  return /\.(pwlevel|zip)$/i.test(file.name)
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000) // after the browser has started the download
}
