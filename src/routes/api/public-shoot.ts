import { createFileRoute } from "@tanstack/react-router";
import { doc, getDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export const Route = createFileRoute("/api/public-shoot")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id")?.trim();
        if (!id) {
          return Response.json({ ok: false, error: "id required" }, { status: 400 });
        }

        try {
          const db = getDb();
          const shootRef = doc(db, "shoots", id);
          const snap = await getDoc(shootRef);
          if (!snap.exists()) {
            return Response.json({ ok: false, error: "not found" }, { status: 404 });
          }
          const data = snap.data() as Record<string, unknown>;
          const isPublic = Boolean(data.public);
          if (!isPublic) {
            return Response.json({ ok: false, error: "not found" }, { status: 404 });
          }
          const hasPassword = typeof data.password === "string" && (data.password as string).length > 0;
          const rawTs = data["createdAt"];
          let createdAt = Date.now();
          if (rawTs && typeof (rawTs as { toMillis?: () => number }).toMillis === "function") {
            createdAt = (rawTs as { toMillis: () => number }).toMillis();
          } else if (typeof rawTs === "number") {
            createdAt = rawTs;
          }
          return Response.json({
            ok: true,
            shootId: id,
            hasPassword,
            title: (data.title as string | undefined),
            email: (data.email as string | undefined) ?? null,
            createdAt,
            fileUrls: [],
            aiResults: [],
          });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 },
          );
        }
      },
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Request body must be JSON" }, { status: 400 });
        }
        const { id, password } = (body ?? {}) as { id?: string; password?: string };
        if (!id) {
          return Response.json({ ok: false, error: "id required" }, { status: 400 });
        }

        try {
          const db = getDb();
          const shootRef = doc(db, "shoots", id);
          const snap = await getDoc(shootRef);
          if (!snap.exists()) {
            return Response.json({ ok: false, error: "not found" }, { status: 404 });
          }
          const data = snap.data() as Record<string, unknown>;
          const isPublic = Boolean(data.public);
          if (!isPublic) {
            return Response.json({ ok: false, error: "not found" }, { status: 404 });
          }
          const stored = typeof data.password === "string" ? data.password : "";
          if (stored.length > 0) {
            if (!password || password !== stored) {
              return Response.json(
                { ok: false, error: "Неверный пароль", needsPassword: true },
                { status: 403 },
              );
            }
          }
          const rawTs = data["createdAt"];
          let createdAt = Date.now();
          if (rawTs && typeof (rawTs as { toMillis?: () => number }).toMillis === "function") {
            createdAt = (rawTs as { toMillis: () => number }).toMillis();
          } else if (typeof rawTs === "number") {
            createdAt = rawTs;
          }
          return Response.json({
            ok: true,
            shootId: id,
            hasPassword: stored.length > 0,
            title: (data.title as string | undefined),
            email: (data.email as string | undefined) ?? null,
            createdAt,
            fileUrls: (data.fileUrls as string[]) ?? [],
            aiResults: (data.aiResults as Array<{ url: string; score: number | null; status: string; error?: string }>) ?? [],
            public: isPublic,
          });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 },
          );
        }
      },
    },
  },
});