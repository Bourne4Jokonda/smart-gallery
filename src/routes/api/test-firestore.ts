import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/test-firestore")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { adminAddDoc, adminQueryByField } = await import("@/lib/firestore-admin");
          const id = await adminAddDoc("aiDescriptions", {
            photoUrl: "https://test.example.com/photo.jpg",
            description: "test description",
            tags: ["test"],
            createdAt: new Date().toISOString(),
          });
          const rows = await adminQueryByField("aiDescriptions", "photoUrl", "https://test.example.com/photo.jpg", 1);
          return Response.json({ ok: true, addedId: id, found: rows.length, row: rows[0] ?? null });
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