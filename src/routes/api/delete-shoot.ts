import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/delete-shoot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { folder, email, shootId } = body as {
            folder?: string;
            email?: string;
            shootId?: string;
          };

          let targetFolder: string | undefined = folder;

          if (!targetFolder && email && shootId) {
            const emailSafe = email.replace(/@/g, "_at_").replace(/\./g, "_dot_");
            targetFolder = `smart-gallery/${emailSafe}/${shootId}`;
          }

          if (!targetFolder) {
            return Response.json(
              { ok: false, error: "folder (or email + shootId) is required" },
              { status: 400 }
            );
          }

          const { v2: cloudinary } = await import("cloudinary");
          cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME ?? process.env.VITE_CLOUDINARY_CLOUD_NAME ?? "",
            api_key: process.env.CLOUDINARY_API_KEY ?? process.env.VITE_CLOUDINARY_API_KEY ?? "",
            api_secret: process.env.CLOUDINARY_API_SECRET ?? process.env.VITE_CLOUDINARY_API_SECRET ?? "",
          });

          // Delete all resources under the given folder prefix
          const deleted = await cloudinary.api.deleteResourcesByPrefix(targetFolder);

          // Try to delete the folder itself (works when empty after deletion above)
          let folderDeleted = false;
          try {
            await cloudinary.api.deleteFolder(targetFolder);
            folderDeleted = true;
          } catch {
            // Folder may not be empty or not exist — ignore
          }

          const deletedCount =
            deleted?.deleted?.length ?? Object.keys(deleted?.deleted ?? {}).length;

          return Response.json({
            ok: true,
            deleted: deletedCount,
            folder: targetFolder,
            folderDeleted,
          });
        } catch (err) {
          console.error("[delete-shoot] error:", err);
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 }
          );
        }
      },
    },
  },
});
