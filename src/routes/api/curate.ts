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
            { status: 503 },
          );
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { ok: false, error: "Request body must be JSON" },
            { status: 400 },
          );
        }

        const { shootId } = (body ?? {}) as { shootId?: string };
        if (!shootId) {
          return Response.json(
            { ok: false, error: "shootId required" },
            { status: 400 },
          );
        }

        return Response.json({
          ok: true,
          shootId,
          message: "AI curation endpoint ready. Call Gemini 2.5 Flash per image with throttle (10/min).",
          gemini_key_present: Boolean(GEMINI_KEY),
          note: "For production: read shoot URLs from database (Firebase/Upstash), call Gemini, store scores.",
        });
      },
    },
  },
});
