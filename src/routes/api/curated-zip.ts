import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/curated-zip
 * Тело: { id: string, password?: string }
 *
 * Логика Этапа 2:
 * 1. Проверяет доступ к сессии (пароль на сервере, как /api/public-shoot)
 * 2. Берёт fileUrls из shoot документа
 * 3. Оценивает каждое фото через Gemini 2.5 Flash (батчи 10, пауза 1.5 с)
 * 4. Сортирует по убыванию scores, берёт топ-10
 * 5. Для каждого топ-кадра формирует Cloudinary URL с ч/Б + водяным знаком
 * 6. Скачивает трансформированные изображения, упаковывает в ZIP (jszip)
 * 7. Отдаёт ZIP как вложение (application/zip)
 *
 * Никакой локальной обработки изображений — только Cloudinary + jszip.
 * Работает на слабом железе и в serverless (Vercel).
 */

function getPublicIdFromUrl(url: string): string | null {
  try {
    const obj = new URL(url);
    const segments = obj.pathname.split("/");
    const uploadIdx = segments.indexOf("upload");
    if (uploadIdx === -1) return null;
    const after = segments.slice(uploadIdx + 1);
    let start = 0;
    if (after.length > 0 && /^v\d+$/.test(after[0])) start = 1;
    const withExt = after.slice(start).join("/");
    return withExt.split(".").slice(0, -1).join(".") || null;
  } catch {
    return null;
  }
}

async function scoreImageWithGemini(
  imageUrl: string,
  apiKey: string,
): Promise<number> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const prompt =
    "Оцени это фото для профессионального портфолио фотографа по шкале 1-10. Учитывай техническое качество, композицию, свет и эмоциональный эффект. Отвечай только целым числом.";

  let base64Data: string;
  let mimeType = "image/jpeg";

  try {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error("Не удалось загрузить изображение: " + imageResponse.status);
    }
    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    base64Data = buffer.toString("base64");
    const contentType = imageResponse.headers.get("content-type") || "";
    if (contentType) mimeType = contentType.split(";")[0].trim();
  } catch (error) {
    throw new Error(
      "Ошибка загрузки изображения для AI: " +
        (error instanceof Error ? error.message : "неизвестная ошибка"),
    );
  }

  const payload = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data: base64Data } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: { temperature: 0.2, maxOutputTokens: 16 },
  };

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      const parsed = Number(text);
      if (!Number.isFinite(parsed)) {
        throw new Error("AI вернул не оценку: " + (text || "пустой ответ"));
      }
      return Math.round(Math.min(10, Math.max(1, parsed)));
    }

    const errorText = await response.text().catch(() => "");
    const isQuota = response.status === 429;
    const isLast = attempt === maxAttempts;
    if (isQuota && !isLast) {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      continue;
    }
    const prefix = isQuota ? "Превышен лимит Gemini" : "Gemini error " + response.status;
    throw new Error(prefix + ": " + errorText.slice(0, 200));
  }

  throw new Error("Превышен лимит Gemini после повторных попыток");
}

function cloudinaryTransformedUrl(
  cloudName: string,
  publicId: string,
): string {
  const transformations = [
    "e_grayscale",
    "l_text:Source_Sans_3_40:Smart%20Gallery",
    "g_south_east",
    "x_10",
    "y_10",
    "o_60",
  ].join(",");

  return "https://res.cloudinary.com/" + cloudName + "/image/upload/" + transformations + "/v1/" + publicId;
}

export const Route = createFileRoute("/api/curated-zip")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { ok: false, error: "Request body must be JSON" },
            { status: 400 },
          );
        }

        const { id, password } = (body ?? {}) as {
          id?: string;
          password?: string;
        };
        if (!id) {
          return Response.json(
            { ok: false, error: "shootId required" },
            { status: 400 },
          );
        }

        // ---------- 1. Доступ к сессии (как public-shoot) ----------
        let shootData: Record<string, unknown> | null;
        try {
          const { adminGetDoc } = await import("@/lib/firestore-admin");
          shootData = await adminGetDoc("shoots", id);
          if (!shootData) {
            return Response.json(
              { ok: false, error: "not found" },
              { status: 404 },
            );
          }
          const isPublic = Boolean(shootData["public"]);
          if (!isPublic) {
            return Response.json(
              { ok: false, error: "not found" },
              { status: 404 },
            );
          }
          const stored = typeof shootData["password"] === "string"
            ? (shootData["password"] as string)
            : "";
          if (stored.length > 0) {
            if (!password || password !== stored) {
              return Response.json(
                { ok: false, error: "Неверный пароль", needsPassword: true },
                { status: 403 },
              );
            }
          }
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 },
          );
        }

        const fileUrls: string[] = (shootData["fileUrls"] as string[]) ?? [];
        if (fileUrls.length === 0) {
          return Response.json(
            { ok: false, error: "Нет фото в сессии" },
            { status: 400 },
          );
        }

        // ---------- 2. Gemini API ключ ----------
        let GEMINI_KEY = (process.env["GEMINI_API_KEY"] ?? process.env.VITE_GEMINI_API_KEY ?? "").trim();
        if (!GEMINI_KEY || GEMINI_KEY.includes("REPLACE")) {
          try {
            const fs = await import("fs");
            const envContent = fs.readFileSync(".env", "utf-8");
            const match = envContent.match(/GEMINI_API_KEY\s*=\s*([^\n]+)/);
            if (match?.[1] && !match[1].includes("REPLACE")) {
              GEMINI_KEY = match[1].trim();
            }
          } catch {
            // ignore .env read errors
          }
        }
        if (!GEMINI_KEY || GEMINI_KEY.includes("REPLACE")) {
          return Response.json(
            { ok: false, error: "GEMINI_API_KEY not configured" },
            { status: 503 },
          );
        }

        // ---------- 3. Оценка фото (как /api/curate) ----------
        const results: Array<{
          url: string;
          publicId: string | null;
          score: number | null;
          status: string;
        }> = [];

        const BATCH_SIZE = 10;
        const DELAY_MS = 1500;
        for (let i = 0; i < fileUrls.length; i += BATCH_SIZE) {
          const batch = fileUrls.slice(i, i + BATCH_SIZE);
          const batchResults = await Promise.all(
            batch.map(async (url) => {
              const publicId = getPublicIdFromUrl(url);
              try {
                const score = await scoreImageWithGemini(url, GEMINI_KEY);
                return { url, publicId, score, status: "ok" as const };
              } catch (error) {
                return {
                  url,
                  publicId,
                  score: null,
                  status: "error" as const,
                };
              }
            }),
          );
          results.push(...batchResults);
          if (i + BATCH_SIZE < fileUrls.length) {
            await new Promise((r) => setTimeout(r, DELAY_MS));
          }
        }

        // ---------- 4. Топ-10 по оценке ----------
        const scored = results
          .filter((r) => r.score !== null && r.publicId)
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .slice(0, 10);

        if (scored.length === 0) {
          return Response.json(
            { ok: false, error: "Не удалось оценить фото" },
            { status: 500 },
          );
        }

        // ---------- 5. Cloudinary ----------
        const cloudName =
          (process.env["VITE_CLOUDINARY_CLOUD_NAME"] ?? "dmhfqxswo").trim() || "dmhfqxswo";

        // ---------- 6. ZIP (динамический импорт jszip, чтобы парсер не валился) ----------
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();
        const folder = zip.folder("smart-gallery-top-10-" + id) || zip;

        for (const item of scored) {
          if (!item.publicId) continue;
          const transformedUrl = cloudinaryTransformedUrl(cloudName, item.publicId);
          const fileName = item.publicId.split("/").pop() + "-top" + (scored.indexOf(item) + 1) + ".jpg";

          try {
            const imgRes = await fetch(transformedUrl);
            if (!imgRes.ok) continue;
            const buf = await imgRes.arrayBuffer();
            folder.file(fileName, buf);
          } catch {
            // skip failed image, continue with others
          }
        }

        const zipBuffer = await folder.generateAsync({
          type: "nodebuffer",
          compression: "DEFLATE",
          compressionOptions: { level: 6 },
        });

        return new Response(zipBuffer, {
          status: 200,
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": 'attachment; filename="smart-gallery-top-10-' + id + '.zip"',
            "Content-Length": String(zipBuffer.length),
          },
        });
      },
    },
  },
});