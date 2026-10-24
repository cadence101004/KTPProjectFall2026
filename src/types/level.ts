// Shapes of a level file. All times are seconds of song time (see AudioClock.songTime).

// A breather between minigames. Shows lives remaining and the upcoming prompt.
export interface BufferClip {
  type: 'buffer'
  start: number
  end: number
}

// One minigame on the game track. gameId matches a MiniGameMeta.id.
export interface GameClip {
  type: 'game'
  gameId: string
  start: number
  end: number
  difficulty: number
}

// Game track entries. Never overlap each other.
export type Clip = BufferClip | GameClip

// Frosted cover drawn over background media. blur is in pixels, dim runs 0 (none) to 1 (black).
export interface MediaEffects {
  blur: number
  dim: number
}

// A background image or video on the media track, behind the game track.
export interface MediaClip {
  kind: 'image' | 'video'
  src: string
  mediaHash: string
  start: number
  end: number
  mediaOffset: number // where in the video file playback begins; ignored for images
  effects: MediaEffects
}

export interface Level {
  title: string
  audioHash: string
  bpm: number
  clips: Clip[]
  media: MediaClip[]
}
