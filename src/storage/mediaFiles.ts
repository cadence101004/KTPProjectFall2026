import type { MediaClip } from '../types/level'
import { loadMedia } from './db'

export interface MediaFile {
  name: string
  file: Blob
  url: string // object URL the browser can play
}

// Loads every stored file a level's media track uses, keyed by mediaHash. Files that aren't stored in this
// browser are left out, and the media layer shows the default background in their place.
export async function loadMediaFiles(clips: MediaClip[]): Promise<Map<string, MediaFile>> {
  const files = new Map<string, MediaFile>()
  for (const hash of new Set(clips.map(clip => clip.mediaHash))) {
    const stored = await loadMedia(hash)
    if (stored) files.set(hash, { ...stored, url: URL.createObjectURL(stored.file) })
  }
  return files
}

// Just the playable URLs, for MediaLayer.setMedia.
export function mediaUrls(files: Map<string, MediaFile>): Map<string, string> {
  return new Map([...files].map(([hash, file]) => [hash, file.url]))
}
