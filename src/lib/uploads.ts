import { uploadToCloudinary, isCloudinaryConfigured } from "@/lib/cloudinary";

export { isCloudinaryConfigured };

export interface ShootUploadResult {
  fileUrls: string[];
  shootId: string;
}

export type UploadProgressHandler = (index: number, percent: number) => void;

export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_FILES = 2000;

export function validate(file: File): { valid: boolean; reason: string } {
  if (!file.type.startsWith("image/")) {
    return { valid: false, reason: "Не изображение" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, reason: "Больше 20 МБ" };
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
    const file = files[i]!;
    const url = await uploadToCloudinary(file, (percent) => {
      options.onProgress?.(i, percent);
    });
    fileUrls.push(url);
  }

  // Для сохранения метаданной съёмки можно использовать Firebase Firestore,
  // если нужна отслеживаемость и/или интеграция с Telegram-уведомлениями.
  return { fileUrls, shootId: "" };
}
