import { createFileRoute } from "@tanstack/react-router";
import { uploadToCloudinary } from "@/lib/cloudinary";

export const Route = createFileRoute("/api/upload-watermark")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const file = form.get("file");
          if (!file || !(file instanceof File)) {
            return Response.json({ ok: false, error: "file required" }, { status: 400 });
          }

          const url = await uploadToCloudinary(file, {
            folder: "smart-gallery/watermarks",
          });

          return Response.json({ ok: true, url });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
