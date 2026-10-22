import { createFileRoute } from "@tanstack/react-router";

/**
 * Owner-only single-photo delete.
 *
 * The caller must be the shoot owner, and the photo must belong to that shoot —
 * otherwise anyone could delete arbitrary Cloudinary assets by guessing a publicId.
 */
export const Route = createFileRoute("/api/delete-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { publicId, shootId } = body as { publicId?: string; shootId?: string };
          if (!publicId || typeof publicId !== "string") {
            return Response.json(
              { ok: false, error: "publicId is required and must be a string" },
              { status: 400 }
            );
          }
          if (!shootId || typeof shootId !== "string") {
            return Response.json(
              { ok: false, error: "shootId is required" },
              { status: 400 }
            );
          }

          const { verifyShootOwner } = await import("@/lib/server-auth");
          const ownerUid = await verifyShootOwner(request, shootId);
          if (!ownerUid) {
            return Response.json(
              { ok: false, error: "forbidden" },
              { status: 403 }
            );
          }

          // Фото должно принадлежать этой съёмке — иначе можно было бы удалить
          // чужой файл, зная его publicId.
          const { getAdminDb } = await import("@/lib/firebase-admin");
          const db = getAdminDb();
          const snap = await db.collection("shoots").doc(shootId).get();
          const fileUrls = snap.exists
            ? ((snap.data()?.fileUrls as string[]) ?? [])
            : [];
          const belongsToShoot = fileUrls.some(
            (url) => url.includes(publicId) || url.includes(encodeURIComponent(publicId)),
          );
          if (!belongsToShoot) {
            return Response.json(
              { ok: false, error: "photo does not belong to this shoot" },
              { status: 403 }
            );
          }

          // Load cloudinary server-side
          const { v2: cloudinary } = await import("cloudinary");
          cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME ?? process.env.VITE_CLOUDINARY_CLOUD_NAME ?? "",
            api_key: process.env.CLOUDINARY_API_KEY ?? process.env.VITE_CLOUDINARY_API_KEY ?? "",
            api_secret: process.env.CLOUDINARY_API_SECRET ?? process.env.VITE_CLOUDINARY_API_SECRET ?? "",
          });

          const result = await cloudinary.uploader.destroy(publicId, {
            invalidate: true,
          });

          if (result.result === "ok" || result.result === "not found") {
            return Response.json({ ok: true, result });
          } else {
            return Response.json(
              { ok: false, error: `Cloudinary deletion failed: ${result.result}` },
              { status: 500 }
            );
          }
        } catch (err) {
          console.error("[delete-image] error:", err);
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 }
          );
        }
      },
    },
  },
});