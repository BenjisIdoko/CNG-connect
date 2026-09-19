/**
 * Downscale + re-encode a photo to a compact JPEG data URL, client-side.
 * Phone photos are 3-8 MB; these are stored inline and re-downloaded by every
 * driver on every load, so keep them ~100-250 KB. Falls back to the original
 * file's data URL if the browser can't decode/encode it.
 */
export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the image file.'));
    reader.readAsDataURL(file);
  });
}

export async function compressImageToDataUrl(
  file: File,
  maxDimension = 1280,
  quality = 0.72
): Promise<string> {
  const original = await readAsDataUrl(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('unreadable'));
      el.src = original;
    });

    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const compressed = canvas.toDataURL('image/jpeg', quality);
    // Never return something bigger than what we started with.
    return compressed.length < original.length ? compressed : original;
  } catch {
    return original;
  }
}
