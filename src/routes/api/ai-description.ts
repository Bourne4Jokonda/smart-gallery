import { createFileRoute } from "@tanstack/react-router";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";
// Free Gemini endpoint accepts ~15 requests/min (throttled in caller).
// Mirrors the working pattern from /api/curate.ts.
const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_MAX_OUTPUT_TOKENS = 400;
const GEMINI_RETRY_ON_429 = true;

// Models in priority order: primary -> fallback 1 -> fallback 2
const VISION_MODELS = [
  "thinkingmachines/inkling:free",      // primary: 41B active MoE, 1M context
  "nvidia/nemotron-3.5-super-vl:free",  // fallback: 12B active MoE, vision+video
  "openrouter/free",                     // last resort: random free model
];

async function describeWithGemini(photoUrl: string, apiKey: string): Promise<string> {
  const endpoint = `${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;

  // Fetch + base64-encode the image (server-side, same as curate.ts)
  const imageResponse = await fetch(photoUrl);
  if (!imageResponse.ok) {
    throw new Error(`Не удалось загрузить изображение: HTTP ${imageResponse.status}`);
  }
  const arrayBuffer = await imageResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64Data = buffer.toString("base64");
  const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
  const mimeType = contentType.split(";")[0].trim();

  const prompt =
    'Опиши это фото для профессионального фотографа на русском языке. Выведи описание одним предложением (профессиональным, не поэтичным), затем пять тегов через запятую. Формат: "Описание: <одно предложение>\\nТеги: <тэг1>, <тэг2>, <тэг3>, <тэг4>, <тэг5>".';

  const payload = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
    },
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
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
      const text =
        data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      if (!text) throw new Error("Gemini returned empty content");
      return text;
    }

    if (response.status === 429 && GEMINI_RETRY_ON_429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      continue;
    }

    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Gemini error ${response.status}: ${errorText.slice(0, 200)}`,
    );
  }

  throw new Error("Превышен лимит Gemini");
}

const SYSTEM_PROMPT = `\
You are a professional photo assistant for a photographer's gallery.
Your task: describe the image in Russian in ONE short sentence (professional, not poetic), then list exactly 5 comma-separated keywords/tags describing what's in the photo.
Output format:
Description: <one sentence in Russian>
Tags: <tag1>, <tag2>, <tag3>, <tag4>, <tag5>`;

// ---------- Firebase cache: BEST-EFFORT only, never blocks the AI response ----------

async function getCachedDescription(
  photoUrl: string,
): Promise<{ description: string; tags: string[] } | null> {
  try {
    const { adminQueryByField } = await import("@/lib/firestore-admin");
    const rows = await adminQueryByField("aiDescriptions", "photoUrl", photoUrl, 1);
    if (rows.length === 0) return null;
    const docData = rows[0]!;
    return {
      description: docData.description as string,
      tags: (docData.tags as string[]) ?? [],
    };
  } catch (e) {
    // Cache read failure (e.g. Firestore permissions) is non-fatal: treat as miss.
    console.error("[ai-description] cache read failed:", e);
  }
  return null;
}

async function saveDescription(
  photoUrl: string,
  description: string,
  tags: string[],
): Promise<void> {
  try {
    const { adminAddDoc } = await import("@/lib/firestore-admin");
    await adminAddDoc("aiDescriptions", {
      photoUrl,
      description,
      tags,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    // non-fatal: cache write failure shouldn't block the response
    console.error("[ai-description] cache save failed:", e);
  }
}

export const Route = createFileRoute("/api/ai-description")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const photoUrl = url.searchParams.get("photoUrl")?.trim();
          if (!photoUrl) {
            return Response.json(
              { ok: false, error: "photoUrl required" },
              { status: 400 },
            );
          }
          const cached = await getCachedDescription(photoUrl);
          if (cached) {
            return Response.json({ ok: true, cached: true, ...cached });
          }
          return Response.json({
            ok: true,
            cached: false,
            description: null,
            tags: [],
          });
        } catch (err) {
          return Response.json(
            {
              ok: false,
              error: err instanceof Error ? err.message : "Unknown error",
            },
            { status: 500 },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { photoUrl } = body ?? {};

          if (!photoUrl || typeof photoUrl !== "string") {
            return Response.json(
              { ok: false, error: "photoUrl required" },
              { status: 400 },
            );
          }

          // 1. Check cache first (best-effort)
          const cached = await getCachedDescription(photoUrl);
          if (cached) {
            return Response.json({ ok: true, cached: true, ...cached });
          }

          // 2a. Try OpenRouter models in order until one succeeds
          let lastError: string | null = null;
          let resultText = "";

          for (const model of VISION_MODELS) {
            try {
              const response = await fetch(OPENROUTER_BASE, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                  "Content-Type": "application/json",
                  "HTTP-Referer":
                    process.env.VITE_SITE_URL ??
                    "https://aleksandr-faraonov.vercel.app",
                  "X-Title": "Smart Gallery",
                },
                body: JSON.stringify({
                  model,
                  messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    {
                      role: "user",
                      content: [
                        {
                          type: "text",
                          text: "Опиши это фото для фотографа на русском языке. Выведи описание одним предложением и 5 тегов через запятую.",
                        },
                        { type: "image_url", image_url: { url: photoUrl } },
                      ],
                    },
                  ],
                  max_tokens: 500,
                  temperature: 0.3,
                }),
              });

              if (!response.ok) {
                lastError = `${model}: HTTP ${response.status}`;
                continue;
              }

              const data = await response.json();
              resultText = data.choices?.[0]?.message?.content ?? "";
              if (!resultText) {
                lastError = `${model}: empty response`;
                continue;
              }
              break; // success
            } catch (err) {
              lastError = `${model}: ${err instanceof Error ? err.message : String(err)}`;
              continue;
            }
          }

          // 2b. If all OpenRouter models failed, fall back to Gemini (free, deployed)
          if (!resultText) {
            try {
              const geminiKey =
                (process.env.GEMINI_API_KEY ?? "").trim().replace(/^sk-|REPLACE/, "");
              if (!geminiKey) {
                lastError = "Gemini_API_KEY not configured on server";
              } else {
                await new Promise((r) => setTimeout(r, 800)); // respect 15 RPM
                resultText = await describeWithGemini(photoUrl, geminiKey);
              }
            } catch (err) {
              lastError =
                err instanceof Error ? err.message : "Gemini fallback failed";
            }
          }

          if (!resultText) {
            return Response.json(
              {
                ok: false,
                error: `Все провайдеры недоступны. Последняя ошибка: ${lastError}`,
              },
              { status: 502 },
            );
          }

          // 3. Parse response
          const descriptionMatch = resultText.match(
            /(?:Description|Описание):\s*([\s\S]*?)(?:\n|$)/i,
          );
          const tagsMatch = resultText.match(
            /(?:Tags|Теги):\s*([\s\S]*?)(?:\n|$)/i,
          );

          const description =
            descriptionMatch?.[1]?.trim() ?? resultText.trim();
          const rawTags = tagsMatch?.[1]?.split(",").map((t) => t.trim()).filter(Boolean) ?? [];

          // 4. Save to Firebase cache (best-effort)
          await saveDescription(photoUrl, description, rawTags);

          return Response.json({
            ok: true,
            cached: false,
            description,
            tags: rawTags,
          });
        } catch (err) {
          return Response.json(
            {
              ok: false,
              error: err instanceof Error ? err.message : "Unknown error",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
