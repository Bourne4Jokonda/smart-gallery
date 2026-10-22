import { createFileRoute } from "@tanstack/react-router";

/**
 * Owner-only Cloudinary folder wipe.
 *
 * These routes destroy data, so every request must carry the caller's Firebase
 * ID token and the shoot must belong to that caller. Previously anyone who
 * knew a shootId could wipe a photographer's whole Cloudinary folder.
 */
export const Route = createFileRoute("/api/delete-shoot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { email, shootId } = body as {
            email?: string;
            shootId?: string;
          };

          if (!shootId) {
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

          // Папка вычисляется из проверенного shootId — клиент не может
          // подсунуть произвольный префикс для удаления.
          const { adminGetDoc } = await import("@/lib/firestore-admin");
          const shootData = await adminGetDoc("shoots", shootId);
          const storedEmail = (shootData?.email as string | undefined) ?? "";
          const effectiveEmail = storedEmail || email || "";
          const emailSafe = effectiveEmail.replace(/@/g, "_at_").replace(/\./g, "_dot_");
          const targetFolder = `smart-gallery/${emailSafe}/${shootId}`;

          const { v2: cloudinary } = await import("cloudinary");
          cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME ?? process.env.VITE_CLOUDINARY_CLOUD_NAME ?? "",
            api_key: process.env.CLOUDINARY_API_KEY ?? process.env.VITE_CLOUDINARY_API_KEY ?? "",
            api_secret: process.env.CLOUDINARY_API_SECRET ?? process.env.VITE_CLOUDINARY_API_SECRET ?? "",
          });

          // Delete all resources under the given folder prefix
          const deleted = await cloudinary.api.delete_resources_by_prefix(targetFolder);

          // Try to delete the folder itself (works when empty after deletion above)
          let folderDeleted = false;
          try {
            await cloudinary.api.delete_folder(targetFolder);
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
