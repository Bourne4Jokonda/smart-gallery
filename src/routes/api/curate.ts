import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/curate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Priority: Vercel env > .env fallback
        let GEMINI_KEY = (process.env["GEMINI_API_KEY"] ?? process.env.VITE_GEMINI_API_KEY ?? "").trim();
        if (!GEMINI_KEY || GEMINI_KEY.includes("REPLACE")) {
          try {
            const fs = await import("fs");
            const envContent = fs.readFileSync(".env", "utf-8");
            const match = envContent.match(/GEMINI_API_KEY\s*=\s*([^\n]+)/);
            if (match && match[1] && !match[1].includes("REPLACE")) {
              GEMINI_KEY = match[1].trim();
            }
          } catch {
            // ignore .env read errors
          }
        }

        if (!GEMINI_KEY || GEMINI_KEY.includes("REPLACE")) {
          return Response.json(
            { ok: false, error: "GEMINI_API_KEY not configured" },
            { status: 503 }
          );
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { ok: false, error: "Request body must be JSON" },
            { status: 400 }
          );
        }

        const { shootId, fileUrls } = (body ?? {}) as {
          shootId?: string;
          fileUrls?: string[];
        };

        if (!shootId) {
          return Response.json(
            { ok: false, error: "shootId required" },
            { status: 400 }
          );
        }

        if (!Array.isArray(fileUrls) || fileUrls.length === 0) {
          return Response.json(
            { ok: false, error: "fileUrls required" },
            { status: 400 }
          );
        }

        const MAX_IMAGES = 10;
        const urls = fileUrls.slice(0, MAX_IMAGES);

        const results = await Promise.all(
          urls.map(async (url) => {
            try {
              const score = await scoreImageWithGemini(url, GEMINI_KEY);
              return { url, score, status: "ok" as const };
            } catch (error) {
              return {
                url,
                score: null,
                status: "error" as const,
                error: error instanceof Error ? error.message : "Ошибка оценки",
              };
            }
          })
        );

        return Response.json({
          ok: true,
          shootId,
          results,
          note: "Gemini 2.5 Flash used with throttle (10/min).",
        });
      },
    },
  },
});

async function scoreImageWithGemini(imageUrl: string, apiKey: string): Promise<number> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const prompt =
    "Оцени это фото для профессионального портфолио фотографа по шкале 1-10. Учитывай техническое качество, композицию, свет и эмоциональный эффект. Отвечай только целым числом.";

  let base64Data: string;
  let mimeType = "image/jpeg";

  try {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Не удалось загрузить изображение: ${imageResponse.status}`);
    }
    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    base64Data = buffer.toString("base64");
    const contentType = imageResponse.headers.get("content-type") || "";
    if (contentType) {
      mimeType = contentType.split(";")[0].trim();
    }
  } catch (error) {
    throw new Error(
      `Ошибка загрузки изображения для AI: ${error instanceof Error ? error.message : "неизвестная ошибка"}`
    );
  }

  const payload = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 16,
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Gemini error ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    throw new Error(`AI вернул не оценку: ${text || "пустой ответ"}`);
  }

  return Math.round(Math.min(10, Math.max(1, parsed)));
}
