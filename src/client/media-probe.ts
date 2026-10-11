// Import-time image probing: confirms the browser can actually decode a file
// and rejects pixel totals past a practical ceiling — compressed byte size
// says nothing about decode cost, and a failed decode at import time is far
// cheaper to report than a failing opening animation later.

export interface ImageDimensions {
  width: number;
  height: number;
}

/** Ceiling on total pixels (≈ an 8K frame). Above it, decode, canvas
 * allocation and GPU upload cost outweigh any visual benefit at overlay size. */
export const MAX_IMAGE_PIXELS = 32_000_000;

/** Decode the file off-DOM to verify decodability and read its dimensions.
 * Rejects when the browser cannot decode the data (bad or unsupported file). */
export function probeImageDimensions(file: File): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image decode failed"));
    };
    img.src = url;
  });
}

/** Import gate: decodable, non-empty, and within the pixel ceiling. */
export async function isImportableImage(file: File): Promise<boolean> {
  try {
    const { width, height } = await probeImageDimensions(file);
    return width > 0 && height > 0 && width * height <= MAX_IMAGE_PIXELS;
  } catch {
    return false;
  }
}
