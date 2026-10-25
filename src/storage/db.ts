import { type DBSchema, openDB } from 'idb'
import type { Level } from '../types/level'
import { normalizeLevel } from './levelFormat'

export interface LevelRecord {
  id: string
  level: Level
  updatedAt: number // ms since epoch, for sorting the level list
}

// A stored file, keyed by its SHA-256 hash: a song (a level's audioHash) or a media file (a mediaHash).
interface FileRecord {
  hash: string
  name: string // original file name, shown to the user
  file: Blob
}

interface PirateWareDB extends DBSchema {
  levels: { key: string; value: LevelRecord }
  songs: { key: string; value: FileRecord }
  media: { key: string; value: FileRecord }
}

// Everything is stored in the player's own browser. Each song or media file is stored once per hash,
// however many levels use it. Version 2 added the media store; upgrading keeps existing levels and songs.
const db = openDB<PirateWareDB>('pirateware', 2, {
  upgrade(database, oldVersion) {
    if (oldVersion < 1) {
      database.createObjectStore('levels', { keyPath: 'id' })
      database.createObjectStore('songs', { keyPath: 'hash' })
    }
    if (oldVersion < 2) database.createObjectStore('media', { keyPath: 'hash' })
  },
})

export async function saveLevel(id: string, level: Level): Promise<void> {
  await (await db).put('levels', { id, level, updatedAt: Date.now() })
}

export async function loadLevel(id: string): Promise<Level | null> {
  const record = await (await db).get('levels', id)
  return record ? normalizeLevel(record.level) : null
}

// Every saved level, most recently saved first.
export async function listLevels(): Promise<LevelRecord[]> {
  const records = await (await db).getAll('levels')
  return records.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function deleteLevel(id: string): Promise<void> {
  await (await db).delete('levels', id)
}

export async function saveSong(hash: string, name: string, file: Blob): Promise<void> {
  await (await db).put('songs', { hash, name, file })
}

export async function loadSong(hash: string): Promise<{ name: string; file: Blob } | null> {
  return (await (await db).get('songs', hash)) ?? null
}

export async function saveMedia(hash: string, name: string, file: Blob): Promise<void> {
  await (await db).put('media', { hash, name, file })
}

export async function loadMedia(hash: string): Promise<{ name: string; file: Blob } | null> {
  return (await (await db).get('media', hash)) ?? null
}
