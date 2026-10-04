import { createFileRoute } from "@tanstack/react-router";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getAuthInstance, getDb } from "@/lib/firebase";

export const Route = createFileRoute("/api/set-shoot-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = getAuthInstance();
        const user = auth.currentUser;
        if (!user) {
          return Response.json({ ok: false, error: "Требуется авторизация" }, { status: 401 });
        }

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
        const pw = typeof password === "string" ? password.trim() : "";
        if (pw.length < 4) {
          return Response.json(
            { ok: false, error: "Пароль минимум 4 символа" },
            { status: 400 },
          );
        }

        try {
          const db = getDb();
          const shootRef = doc(db, "shoots", id);
          const snap = await getDoc(shootRef);
          if (!snap.exists()) {
            return Response.json({ ok: false, error: "not found" }, { status: 404 });
          }
          const data = snap.data() as Record<string, unknown>;
          const ownerId = data.userId as string | undefined;
          if (ownerId !== user.uid) {
            return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
          }
          await setDoc(shootRef, { password: pw }, { merge: true });
          return Response.json({ ok: true, shootId: id });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 },
          );
        }
      },
      DELETE: async ({ request }) => {
        const auth = getAuthInstance();
        const user = auth.currentUser;
        if (!user) {
          return Response.json({ ok: false, error: "Требуется авторизация" }, { status: 401 });
        }

        const url = new URL(request.url);
        const id = url.searchParams.get("id")?.trim();
        if (!id) {
          return Response.json({ ok: false, error: "id required" }, { status: 400 });
        }

        try {
          const db = getDb();
          const shootRef = doc(db, "shoots", id);
          const snap = await getDoc(shootRef);
          if (!snap.exists()) {
            return Response.json({ ok: false, error: "not found" }, { status: 404 });
          }
          const data = snap.data() as Record<string, unknown>;
          const ownerId = data.userId as string | undefined;
          if (ownerId !== user.uid) {
            return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
          }
          await setDoc(shootRef, { password: "" }, { merge: true });
          return Response.json({ ok: true, shootId: id });
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