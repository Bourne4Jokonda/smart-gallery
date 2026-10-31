import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/test-descriptions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const shootId = url.searchParams.get("shootId")?.trim();
          if (!shootId) {
            return Response.json({ ok: false, error: "shootId required" }, { status: 400 });
          }
          const { adminGetDoc } = await import("@/lib/firestore-admin");
          const shoot = await adminGetDoc("shoots", shootId);
          if (!shoot) {
            return Response.json({ ok: false, error: "shoot not found" }, { status: 404 });
          }
          const fileUrls = (shoot.fileUrls as string[]) ?? [];
          const { getCachedDescription } = await import("@/routes/api/ai-description");
          // getCachedDescription is not exported; reimplement via adminQueryByField
          const { adminQueryByField } = await import("@/lib/firestore-admin");
          let cachedCount = 0;
          const sample: Array<{ url: string; cached: boolean }> = [];
          for (const u of fileUrls.slice(0, 5)) {
            const rows = await adminQueryByField("aiDescriptions", "photoUrl", u, 1);
            const c = rows.length > 0;
            if (c) cachedCount++;
            sample.push({ url: u, cached: c });
          }
          // total cached count (query all aiDescriptions for this shoot? not possible; count all docs)
          return Response.json({
            ok: true,
            shootId,
            totalPhotos: fileUrls.length,
            checkedFirst5: sample,
            cachedInFirst5: cachedCount,
          });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : String(err) },
            { status: 500 },
          );
        }
      },
    },
  },
});