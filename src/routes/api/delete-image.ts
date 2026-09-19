import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/delete-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { publicId } = body as { publicId?: string };
          if (!publicId || typeof publicId !== "string") {
            return Response.json(
              { ok: false, error: "publicId is required and must be a string" },
              { status: 400 }
            );
          }

          // Load cloudinary server-side
          const { v2: cloudinary } = await import("cloudinary");
          cloudinary.config({
            cloud_name: process.env.VITE_CLOUDINARY_CLOUD_NAME ?? "",
            api_key: process.env.VITE_CLOUDINARY_API_KEY ?? "",
            api_secret: process.env.VITE_CLOUDINARY_API_SECRET ?? "",
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