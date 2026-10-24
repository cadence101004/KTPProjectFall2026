// SHA-256 of a file as lowercase hex. Levels reference their song by this, so a level can find its MP3
// again (and warn if a player picks a different file) without the MP3 living inside the level.
export async function hashFile(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
