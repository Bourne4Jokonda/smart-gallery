import { createFileRoute } from "@tanstack/react-router";

/**
 * Public gallery access.
 *
 * The shoot document (photos, password) is NOT readable by anonymous clients
 * anymore — Firestore rules only allow the owner to read `shoots/{id}`.
 * Everything the visitor sees comes through this route, which:
 *   1. reads the shoot with Admin SDK (server-side, bypasses rules),
 *   2. checks the gallery password server-side,
 *   3. only then returns the photo list.
 */
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
          const { adminGetDoc } = await import("@/lib/firestore-admin");
          const data = await adminGetDoc("shoots", id);
          if (!data) {
            return Response.json({ ok: false, error: "not found" }, { status: 404 });
          }
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
          const userId = typeof data.userId === "string" ? data.userId : null;
          return Response.json({
            ok: true,
            shootId: id,
            hasPassword,
            title: (data.title as string | undefined),
            email: null,
            createdAt,
            userId,
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
          const { adminGetDoc } = await import("@/lib/firestore-admin");
          const data = await adminGetDoc("shoots", id);
          if (!data) {
            return Response.json({ ok: false, error: "not found" }, { status: 404 });
          }
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
          const userId = typeof data.userId === "string" ? data.userId : null;
          return Response.json({
            ok: true,
            shootId: id,
            hasPassword: stored.length > 0,
            title: (data.title as string | undefined),
            email: null,
            createdAt,
            userId,
            fileUrls: (data.fileUrls as string[]) ?? [],
            aiResults: [],
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