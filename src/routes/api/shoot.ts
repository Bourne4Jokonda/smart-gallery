import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/shoot")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id")?.trim();
        if (!id) {
          return Response.json({ ok: false, error: "id required" }, { status: 400 });
        }

        let fileUrls: string[] = [];
        let email: string | undefined;
        let createdAt = Date.now();

        try {
          const { getAdminDb } = await import("@/lib/firebase-admin");
          const db = getAdminDb();
          const snap = await db.collection("shoots").doc(id).get();
          if (!snap.exists) {
            return Response.json({ ok: false, error: "not found" }, { status: 404 });
          }
          const data = snap.data() as Record<string, unknown>;
          fileUrls = (data.fileUrls as string[]) ?? [];
          email = (data.email as string | undefined) ?? "";
          const rawTs = data["createdAt"];
          if (rawTs && typeof (rawTs as { toMillis?: () => number }).toMillis === "function") {
            createdAt = (rawTs as { toMillis: () => number }).toMillis();
          } else if (typeof rawTs === "number") {
            createdAt = rawTs;
          }
          const aiResults = (data.aiResults as Array<{
            url: string;
            score: number | null;
            status: string;
            error?: string;
          }>) ?? [];
          return Response.json({
            ok: true,
            shootId: id,
            fileUrls,
            email,
            createdAt,
            aiResults,
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
