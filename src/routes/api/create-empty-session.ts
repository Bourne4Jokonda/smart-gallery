import { createFileRoute } from "@tanstack/react-router";
import { getAuthInstance, getDb, serverTimestamp } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp as firestoreServerTimestamp } from "firebase/firestore";

export const Route = createFileRoute("/api/create-empty-session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = getAuthInstance();
          const user = auth.currentUser;
          if (!user) {
            return Response.json({ ok: false, error: "Требуется авторизация" }, { status: 401 });
          }

          let body: { title?: string } = {};
          try {
            body = await request.json();
          } catch {
            // ignore empty body
          }

          const db = getDb();
          const shootId = crypto.randomUUID();
          const now = Date.now();
          const title = (body.title ?? "").trim();

          const record = {
            shootId,
            userId: user.uid,
            email: user.email ?? null,
            title: title || null,
            fileUrls: [],
            aiResults: [],
            public: false,
            password: "",
            createdAt: now,
            updatedAt: now,
          };

          await setDoc(doc(db, "shoots", shootId), record);

          return Response.json({
            ok: true,
            shootId,
            title: record.title,
            public: record.public,
            createdAt: record.createdAt,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
