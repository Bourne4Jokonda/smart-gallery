import { createFileRoute } from "@tanstack/react-router";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

const FIREBASE_API_KEY = import.meta.env["VITE_FIREBASE_API_KEY"] ?? "";

async function verifyIdToken(idToken) {
  if (!idToken || !FIREBASE_API_KEY) return null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.users?.[0]?.localId ?? null;
  } catch {
    return null;
  }
}

function extractBearer(request) {
  const h = request.headers.get("authorization") ?? "";
  if (h.startsWith("Bearer ")) return h.slice(7).trim();
  return "";
}

async function verifyOwner(request, shootId) {
  const uid = await verifyIdToken(extractBearer(request));
  if (!uid) {
    return { ok: false, status: 401, error: "Требуется авторизация" };
  }
  const db = getDb();
  const snap = await getDoc(doc(db, "shoots", shootId));
  if (!snap.exists()) {
    return { ok: false, status: 404, error: "not found" };
  }
  const data = snap.data();
  const ownerId = data.userId;
  if (ownerId !== uid) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  return { ok: true, status: 200, uid };
}

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
          const auth = await verifyOwner(request, id);
          if (!auth.ok) {
            return Response.json({ ok: false, error: auth.error }, { status: auth.status });
          }
          await setDoc(doc(getDb(), "shoots", id), { password: pw }, { merge: true });
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
          const auth = await verifyOwner(request, id);
          if (!auth.ok) {
            return Response.json({ ok: false, error: auth.error }, { status: auth.status });
          }
          await setDoc(doc(getDb(), "shoots", id), { password: "" }, { merge: true });
          return Response.json({ ok: true, shootId: id });
        } catch (err) {
          return Response.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
        }
      },
    },
  },
});
