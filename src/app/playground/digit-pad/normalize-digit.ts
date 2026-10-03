/** Crop ink, fit into a 20px box, then center its mass on a 28px MNIST-style image. */
export function normalizeDigit(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array | null {
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4] > 20) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  if (right < left) return null;
  const scale = 20 / Math.max(right - left + 1, bottom - top + 1),
    w = Math.max(1, Math.round((right - left + 1) * scale)),
    h = Math.max(1, Math.round((bottom - top + 1) * scale));
  const small = new Float32Array(784),
    result = new Float32Array(784);
  // Area averaging keeps thin strokes visible when downsampling.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let sum = 0,
        count = 0;
      for (
        let sy = Math.floor(top + y / scale);
        sy < Math.min(height, Math.ceil(top + (y + 1) / scale));
        sy++
      )
        for (
          let sx = Math.floor(left + x / scale);
          sx < Math.min(width, Math.ceil(left + (x + 1) / scale));
          sx++
        ) {
          sum += rgba[(sy * width + sx) * 4] / 255;
          count++;
        }
      small[(y + 4) * 28 + x + 4] = sum / Math.max(1, count);
    }
  let mass = 0,
    cx = 0,
    cy = 0;
  small.forEach((value, i) => {
    mass += value;
    cx += (i % 28) * value;
    cy += Math.floor(i / 28) * value;
  });
  if (!mass) return null;
  const dx = Math.round(13.5 - cx / mass),
    dy = Math.round(13.5 - cy / mass);
  small.forEach((value, i) => {
    const x = (i % 28) + dx,
      y = Math.floor(i / 28) + dy;
    if (x >= 0 && x < 28 && y >= 0 && y < 28) result[y * 28 + x] = value;
  });
  return result;
}
