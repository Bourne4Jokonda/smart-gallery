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
  shootId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ secure_url?: string } | void> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary не настроен");
  }

  const compressed = await compressImage(file);
  const url = await uploadToCloudinary(compressed, (percent) => {
    onProgress?.(percent);
  });

  return { secure_url: url };
}
