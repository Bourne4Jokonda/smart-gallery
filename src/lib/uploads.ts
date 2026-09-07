import { uploadToCloudinary, isCloudinaryConfigured } from "@/lib/cloudinary";
import { compressImage } from "@/lib/compress";

export { isCloudinaryConfigured };

export interface ShootUploadResult {
  fileUrls: string[];
  shootId: string;
}

export type UploadProgressHandler = (index: number, percent: number) => void;

// Cloudinary free-план режет unsigned > 10 МБ. Сжимаем заранее (см. compress.ts),
// но оставляем небольшой запас: 20 МБ после сжатия — ок, до сжатия можно 100 МБ.
export const MAX_FILE_SIZE = 100 * 1024 * 1024;
export const MAX_FILES = 2000;

export function validate(file: File): { valid: boolean; reason: string } {
  if (!file.type.startsWith("image/")) {
    return { valid: false, reason: "Не изображение" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, reason: "Больше 100 МБ" };
  }
  return { valid: true, reason: "" };
}

export async function uploadShoot(
  files: File[],
  options: { email?: string | null; consent?: boolean; onProgress?: UploadProgressHandler } = {},
): Promise<ShootUploadResult> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary не настроен");
  }

  const fileUrls: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const original = files[i]!;
    // Сжатие: 15 МБ → ~1.5 МБ, 25 МБ → ~2.5 МБ (всё уходит в Cloudinary)
    const compressed = await compressImage(original);

    const url = await uploadToCloudinary(compressed, (percent) => {
      // Прогресс 0-90% — сжатие, 90-100% — загрузка
      // Считаем долю сжатия как фиксированную часть ради простоты
      options.onProgress?.(i, Math.min(90, Math.round((percent * 9) / 10)));
    });
    options.onProgress?.(i, 100);
    fileUrls.push(url);
  }

  return { fileUrls, shootId: "" };
}
