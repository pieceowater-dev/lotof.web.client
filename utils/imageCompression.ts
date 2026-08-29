// Client-side image guard + compressor shared by every upload entry point
// (Menu / Goods / Console publications / Issues delivery photos, ...).
//
// Goals:
//   1. Hard-reject anything that isn't an image, or an image whose *original*
//      file exceeds `maxInputBytes` -- so a 40 MB DSLR JPEG never even starts
//      uploading.
//   2. Downscale to a sane longest-edge and re-encode (WebP, JPEG fallback)
//      so what actually reaches object storage is small -- typically well
//      under a megabyte -- regardless of what the user picked.
//
// Everything runs in the browser via <canvas>; there is no server round-trip
// until the compressed File is handed to the existing upload mutation.

export const DEFAULT_MAX_DIMENSION = 2000;
export const DEFAULT_QUALITY = 0.82;
/** Original-file ceiling. Above this the upload is refused outright. */
export const DEFAULT_MAX_INPUT_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Absolute wire ceiling enforced in the low-level upload functions, as a
 * backstop for any call site that forgot to run `compressImageForUpload`
 * first. Normal paths never hit it -- compression brings images far below.
 */
export const ABS_MAX_UPLOAD_BYTES = DEFAULT_MAX_INPUT_BYTES;

export function assertUploadSize(file: { size: number; type?: string }): void {
  if (file.size > ABS_MAX_UPLOAD_BYTES) {
    throw new Error(
      `File is too large (${mb(file.size)} MB). Maximum is ${mb(ABS_MAX_UPLOAD_BYTES)} MB.`,
    );
  }
}

export interface ImageCompressionOptions {
  /** Longest-edge cap in px; larger images are scaled down to fit. */
  maxDimension?: number;
  /** Lossy-encoder quality, 0-1. */
  quality?: number;
  /** Hard cap on the picked file's size before any processing. */
  maxInputBytes?: number;
  /** Caller's resolved useI18n().t, so the rejection message is localized. */
  t?: (key: string, params?: Record<string, string | number>) => string;
}

export class ImageTooLargeError extends Error {
  code = 'IMAGE_TOO_LARGE';
  constructor(message: string) {
    super(message);
    this.name = 'ImageTooLargeError';
  }
}

export class NotAnImageError extends Error {
  code = 'NOT_AN_IMAGE';
  constructor(message: string) {
    super(message);
    this.name = 'NotAnImageError';
  }
}

function mb(bytes: number): string {
  const v = bytes / (1024 * 1024);
  return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10).toString();
}

function tr(
  t: ImageCompressionOptions['t'],
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
): string {
  if (t) {
    const out = t(key, params);
    if (out && out !== key) return out;
  }
  let msg = fallback;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return msg;
}

function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    // Browsers apply EXIF orientation when drawing an <img> to canvas
    // (image-orientation: from-image is the default), so a portrait phone
    // photo doesn't come out rotated.
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image decode failed'));
    };
    img.src = url;
  });
}

function canEncode(canvas: HTMLCanvasElement, type: string): boolean {
  try {
    return canvas.toDataURL(type).startsWith(`data:${type}`);
  } catch {
    return false;
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });
}

/** Any pixel with alpha below ~opaque means the source carries transparency. */
function canvasHasAlpha(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  try {
    const { data } = ctx.getImageData(0, 0, w, h);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) return true;
    }
    return false;
  } catch {
    // Tainted canvas (shouldn't happen for a user-picked File) -- assume
    // alpha so we don't silently drop it by encoding to JPEG.
    return true;
  }
}

/**
 * Validates and compresses an image File for upload.
 *
 * Throws `NotAnImageError` for non-images and `ImageTooLargeError` when the
 * original exceeds `maxInputBytes` -- both carry a localized, user-safe
 * `.message` that call sites can surface directly.
 *
 * SVG and animated GIF are passed through untouched (still size-checked);
 * an unreadable/corrupt raster is also passed through so the server can
 * reject it with a real error instead of the client swallowing it.
 */
export async function compressImageForUpload(
  file: File,
  opts: ImageCompressionOptions = {},
): Promise<File> {
  const {
    maxDimension = DEFAULT_MAX_DIMENSION,
    quality = DEFAULT_QUALITY,
    maxInputBytes = DEFAULT_MAX_INPUT_BYTES,
    t,
  } = opts;

  if (!file.type.startsWith('image/')) {
    throw new NotAnImageError(
      tr(t, 'common.upload.notAnImage', 'Please choose an image file.'),
    );
  }

  if (file.size > maxInputBytes) {
    throw new ImageTooLargeError(
      tr(
        t,
        'common.upload.tooLarge',
        'This image is {size} MB. The maximum allowed size is {max} MB.',
        { size: mb(file.size), max: mb(maxInputBytes) },
      ),
    );
  }

  // Vector / animated formats: nothing to raster-compress, and canvas would
  // flatten a GIF to one frame. Size cap above still guards them.
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  if (typeof document === 'undefined') return file;

  // Decode. <img> is the most compatible path across browsers (Safari's
  // createImageBitmap has historically choked on progressive / CMYK / EXIF
  // JPEGs) and applies EXIF orientation for free; createImageBitmap is the
  // fallback.
  let source: CanvasImageSource;
  let width: number;
  let height: number;
  let bitmap: ImageBitmap | null = null;
  try {
    const img = await loadHtmlImage(file);
    source = img;
    width = img.naturalWidth;
    height = img.naturalHeight;
  } catch {
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' as any });
      source = bitmap;
      width = bitmap.width;
      height = bitmap.height;
    } catch {
      return file;
    }
  }

  if (!width || !height) {
    bitmap?.close();
    return file;
  }

  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap?.close();
    return file;
  }
  ctx.drawImage(source, 0, 0, targetW, targetH);
  bitmap?.close();

  // Only PNG/WebP sources can carry transparency; a JPEG never does, so
  // skip the pixel scan for it.
  const mayHaveAlpha = file.type === 'image/png' || file.type === 'image/webp';
  const hasAlpha = mayHaveAlpha && canvasHasAlpha(ctx, targetW, targetH);

  // Prefer WebP everywhere it encodes (small, alpha-capable). Otherwise:
  // keep PNG only when the source is actually transparent; every other
  // image -- including an opaque PNG / screenshot on a browser without WebP
  // encoding -- goes to JPEG so it actually shrinks.
  let outType: 'image/webp' | 'image/png' | 'image/jpeg';
  if (canEncode(canvas, 'image/webp')) outType = 'image/webp';
  else if (hasAlpha) outType = 'image/png';
  else outType = 'image/jpeg';

  let blob = await toBlob(canvas, outType, outType === 'image/png' ? undefined : quality);
  if (!blob) return file;

  // Still heavy after a downscale + first encode? One lower-quality pass for
  // the lossy formats.
  if (blob.size > 900 * 1024 && outType !== 'image/png') {
    const smaller = await toBlob(canvas, outType, 0.6);
    if (smaller && smaller.size < blob.size) blob = smaller;
  }

  // Hand back the original only when we changed nothing useful: no
  // downscale, no size win, and the type is unchanged (so we're never
  // returning a bloated PNG where a JPEG would have been far smaller).
  if (scale === 1 && blob.size >= file.size && blob.type === file.type) {
    return file;
  }

  const ext = outType === 'image/webp' ? 'webp' : outType === 'image/png' ? 'png' : 'jpg';
  const baseName = (file.name || 'image').replace(/\.[^./\\]+$/, '') || 'image';
  return new File([blob], `${baseName}.${ext}`, {
    type: outType,
    lastModified: Date.now(),
  });
}
