export const CLOUDINARY_CLOUD_NAME =
  (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined)?.trim() ??
  "";

export const CLOUDINARY_UPLOAD_PRESET = "smart-gallery";

export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUDINARY_CLOUD_NAME);
}

export function getPublicIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname; // e.g., /v1234567890/folder/publicId.jpg
    const segments = pathname.split('/');
    // Find index of 'upload'
    const uploadIdx = segments.indexOf('upload');
    if (uploadIdx === -1) return null;
    // The publicId with extension is everything after 'upload'
    const partsAfterUpload = segments.slice(uploadIdx + 1);
    // The first part may be version like 'v1234567890' (starts with v followed by digits)
    let startIdx = 0;
    if (partsAfterUpload.length > 0 && /^v\d+$/.test(partsAfterUpload[0])) {
      startIdx = 1;
    }
    // Join the rest with '/' to rebuild folder path
    const withExt = partsAfterUpload.slice(startIdx).join('/');
    // Remove extension (everything after last dot)
    const publicId = withExt.split('.').slice(0, -1).join('.');
    return publicId || null;
  } catch {
    return null;
  }
}

export async function uploadToCloudinary(
  file: File,
  options?: {
    onProgress?: (percent: number) => void;
    folder?: string;
    publicId?: string;
  },
): Promise<string> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary не настроен");
  }

  const { onProgress, folder, publicId } = options || {};

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    if (folder) {
      form.append("folder", folder);
    }
    if (publicId) {
      form.append("public_id", publicId);
    }

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
