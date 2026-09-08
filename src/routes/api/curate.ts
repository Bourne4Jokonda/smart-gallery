import type { VercelRequest, VercelResponse } from "@vercel/node";
import { saveShoot } from "../../routes/gallery/$id";

// Сохранение оценки для фото в shootRecord (через localStorage-подобный паттерн)
// Для полноценного хранения метаданных потребуется Firebase; здесь — минимальный
// синхронный обработчик для демонстрации AI-отбора через Gemini.

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? process.env.VITE_GEMINI_API_KEY ?? "";

interface ScoreItem {
  url: string;
  composition: number; // 1-10
  sharpness: number;    // 1-10
  score: number;        // среднее
  reason: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!GEMINI_KEY) {
    return res.status(503).json({
      error: "GEMINI_API_KEY not configured",
      hint: "Add GEMINI_API_KEY to Vercel environment variables",
    });
  }

  const { shootId } = (req.body ?? {}) as { shootId?: string };
  if (!shootId) {
    return res.status(400).json({ error: "Missing shootId" });
  }

  // Получаем данные съёмки из localStorage через клиентскую функцию save/read.
  // В serverless-окружении localStorage недоступен, поэтому для полноценной работы
  // необходим Firebase Firestore или Redis. Здесь возвращаем структуру с инструкцией.
  return res.status(200).json({
    status: "ok",
    message: "Endpoint ready. For full pipeline: wire shoot data from Firestore / KV, call Gemini per image with throttle, store scores back.",
    gemini_key_present: Boolean(GEMINI_KEY),
    shootId,
    next_steps: [
      "Add shoot metadata to Firebase / KV at upload time",
      "Fetch file URLs by shootId",
      "Call Gemini 2.5 Flash with prompt: 'Rate photo composition 1-10 and sharpness 1-10. Respond JSON only.'",
      "Store scores back to database",
      "Poll /gallery/$id shows sorted results",
    ],
  });
}
