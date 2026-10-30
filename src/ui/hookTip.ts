// Finds the hook's tip in one of the pirate cursor images, to use as the cursor's click point.
// The tip is the leftmost (then topmost) solid gray or black pixel: the hook's metal and outline are gray
// and black, while the bows, sparkles, and motion lines around it are colored, so those are skipped.
// `pixels` is RGBA data, as from CanvasRenderingContext2D.getImageData.
export function findHookTip(pixels: Uint8ClampedArray, width: number, height: number): { x: number; y: number } {
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4
      const [r, g, b, a] = [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]]
      if (a > 200 && Math.max(r, g, b) - Math.min(r, g, b) < 30) return { x, y }
    }
  }
  return { x: 0, y: 0 }
}
