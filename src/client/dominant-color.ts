// Dominant-color extraction shared by engines that paint the backdrop from
// the user's picture. Pure function over a decoded image; never throws.
// Callers should await img.decode() first: a huge image can fire `load`
// before its pixels are ready, and sampling then yields near-black garbage.

const SAMPLE_SIZE = 32;
const QUANT_BITS = 4; // 16 buckets per channel
const FALLBACK = "#04050e";
/** Pixels darker / flatter than this read as "black background", not the picture's color. */
const DARK_CUTOFF = 40;
const BRIGHT_FLAT_V = 232;
const BRIGHT_FLAT_SAT = 0.12;

/**
 * Quantized-histogram dominant color: downscale to 32x32, bucket pixels at
 * 4 bits per channel ignoring near-black and near-white pixels, average the
 * largest remaining bucket; falls back to the plain average, then to FALLBACK.
 * Returns a `rgb()` string.
 */
export function extractDominantColor(img: HTMLImageElement): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null;
    if (ctx === null) return FALLBACK;
    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

    const counts = new Map<number, number>();
    const sums = new Map<number, [number, number, number]>();
    let allR = 0;
    let allG = 0;
    let allB = 0;
    let allCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3] as number;
      if (alpha < 128) continue;
      const r = data[i] as number;
      const g = data[i + 1] as number;
      const b = data[i + 2] as number;
      allR += r;
      allG += g;
      allB += b;
      allCount++;
      const v = Math.max(r, g, b);
      const sat = v > 0 ? (v - Math.min(r, g, b)) / v : 0;
      if (v < DARK_CUTOFF || (v > BRIGHT_FLAT_V && sat < BRIGHT_FLAT_SAT)) continue;
      const key = ((r >> QUANT_BITS) << 8) | ((g >> QUANT_BITS) << 4) | (b >> QUANT_BITS);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      const sum = sums.get(key) ?? [0, 0, 0];
      sum[0] += r;
      sum[1] += g;
      sum[2] += b;
      sums.set(key, sum);
    }
    let bestKey = -1;
    let bestCount = 0;
    for (const [key, count] of counts) {
      if (count > bestCount) {
        bestCount = count;
        bestKey = key;
      }
    }
    if (bestKey >= 0 && bestCount > 0) {
      const [rSum, gSum, bSum] = sums.get(bestKey) as [number, number, number];
      return `rgb(${Math.round(rSum / bestCount)}, ${Math.round(gSum / bestCount)}, ${Math.round(bSum / bestCount)})`;
    }
    if (allCount > 0) {
      return `rgb(${Math.round(allR / allCount)}, ${Math.round(allG / allCount)}, ${Math.round(allB / allCount)})`;
    }
    return FALLBACK;
  } catch {
    return FALLBACK;
  }
}

/**
 * Run `next` once the image is decoded (huge images can fire `load` before
 * pixels are drawable); falls back to calling `next` immediately when
 * decode() is unavailable or rejects.
 */
export function whenDecoded(img: HTMLImageElement, next: () => void): void {
  if (typeof img.decode === "function") {
    img.decode().then(next, next);
    return;
  }
  next();
}
