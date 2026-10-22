import { createFileRoute } from "@tanstack/react-router";
import { verifyShootOwner } from "@/lib/server-auth";

export const Route = createFileRoute("/api/set-shoot-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Request body must be JSON" }, { status: 400 });
        }
        const { id, password } = body ?? {};
        if (!id) {
          return Response.json({ ok: false, error: "id required" }, { status: 400 });
        }
        const pw = typeof password === "string" ? password.trim() : "";
        if (pw.length < 4) {
          return Response.json({ ok: false, error: "Пароль минимум 4 символа" }, { status: 400 });
        }
        try {
          const ownerUid = await verifyShootOwner(request, id);
          if (!ownerUid) {
            return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
          }
          const { getAdminDb } = await import("@/lib/firebase-admin");
          const db = getAdminDb();
          await db.collection("shoots").doc(id).set({ password: pw }, { merge: true });
          return Response.json({ ok: true, shootId: id });
        } catch (err) {
          return Response.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
        }
      },
      DELETE: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id")?.trim();
        if (!id) {
          return Response.json({ ok: false, error: "id required" }, { status: 400 });
        }
        try {
          const ownerUid = await verifyShootOwner(request, id);
          if (!ownerUid) {
            return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
          }
          const { getAdminDb } = await import("@/lib/firebase-admin");
          const db = getAdminDb();
          await db.collection("shoots").doc(id).set({ password: "" }, { merge: true });
          return Response.json({ ok: true, shootId: id });
        } catch (err) {
          return Response.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
        }
      },
    },
  },
});
