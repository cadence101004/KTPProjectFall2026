import { type DBSchema, openDB } from 'idb'
import type { Level } from '../types/level'
import { normalizeLevel } from './levelFormat'

export interface LevelRecord {
  id: string
  level: Level
  updatedAt: number // ms since epoch, for sorting the level list
}

interface SongRecord {
  hash: string // audioHash of the levels that use it
  name: string // original file name, shown to the user
  file: Blob
}

interface PirateWareDB extends DBSchema {
  levels: { key: string; value: LevelRecord }
  songs: { key: string; value: SongRecord }
}

// Everything is stored in the player's own browser. Songs are stored once per hash, however many levels use them.
const db = openDB<PirateWareDB>('pirateware', 1, {
  upgrade(database) {
    database.createObjectStore('levels', { keyPath: 'id' })
    database.createObjectStore('songs', { keyPath: 'hash' })
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
