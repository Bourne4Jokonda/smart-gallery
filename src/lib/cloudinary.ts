export const CLOUDINARY_CLOUD_NAME =
  (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined)?.trim() ??
  "";

export const CLOUDINARY_UPLOAD_PRESET = "smart-gallery";

export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUDINARY_CLOUD_NAME);
}

export async function uploadToCloudinary(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary не настроен");
  }

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          const url = (data as { secure_url?: string }).secure_url;
          if (!url) throw new Error("secure_url отсутствует в ответе Cloudinary");
          resolve(url);
        } catch (error) {
          reject(
            error instanceof Error
              ? error
              : new Error("Не удалось разобрать ответ Cloudinary"),
          );
        }
      } else {
        let message = `Cloudinary upload failed: ${xhr.status}`;
        try {
          const data = JSON.parse(xhr.responseText) as { error?: { message?: string } };
          const detail = data?.error?.message;
          if (detail) message += ` — ${detail}`;
        } catch {
          // ignore JSON parse errors
        }
        reject(new Error(message));
      }
    };

    xhr.onerror = () => reject(new Error("Сетевая ошибка при загрузке в Cloudinary"));
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    );
    xhr.send(form);
  });
}
