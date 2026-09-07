/// <reference types="vite/client" />

/**
 * Клиентский компрессор изображений.
 * - Сжимает длинную сторону до MAX_DIMENSION (по умолчанию 2048px)
 * - JPEG-качество 0.85 (визуально без потерь, экономит 60-80% размера)
 * - Возвращает File (или исходный, если сжатие не помогло или не поддерживается)
 */
const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 0.85;

export interface CompressOptions {
  maxDimension?: number;
  quality?: number;
}

export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  const maxDim = options.maxDimension ?? MAX_DIMENSION;
  const quality = options.quality ?? JPEG_QUALITY;

  // Если это уже маленький файл (< 500 КБ) — не трогаем, экономим CPU
  if (file.size < 500 * 1024) return file;

  // Только растровые изображения. RAW/HEIC браузер не декодирует в canvas — пропускаем.
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/heic" || file.type === "image/heif") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    // Если обе стороны меньше maxDim — сжимаем только качество (если это JPEG)
    let targetW = width;
    let targetH = height;
    if (width > maxDim || height > maxDim) {
      if (width >= height) {
        targetW = maxDim;
        targetH = Math.round((height * maxDim) / width);
      } else {
        targetH = maxDim;
        targetW = Math.round((width * maxDim) / height);
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        quality,
      );
    });

    const compressedSize = blob.size;
    // Если сжатие не помогло (например, PNG-скриншоты) — оставляем оригинал
    if (compressedSize >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn("compressImage failed, using original", err);
    return file;
  }
}
