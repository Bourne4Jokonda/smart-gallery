import { createFileRoute } from "@tanstack/react-router";
import { doc, getDoc } from "firebase/firestore";
import { getAuthInstance, getDb } from "@/lib/firebase";

export const Route = createFileRoute("/api/shoot")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id")?.trim();
        if (!id) {
          return Response.json({ ok: false, error: "id required" }, { status: 400 });
        }

        let fileUrls: string[] = [];
        let email: string | undefined;
        let createdAt = Date.now();

        try {
          const auth = getAuthInstance();
          const user = auth.currentUser;
          const db = getDb();
          const shootRef = doc(db, "shoots", id);
          const snap = await getDoc(shootRef);
          if (!snap.exists()) {
            return Response.json({ ok: false, error: "not found" }, { status: 404 });
          }
          const data = snap.data() as Record<string, unknown>;
          fileUrls = (data.fileUrls as string[]) ?? [];
          email = (data.email as string | undefined) ?? user?.email ?? "";
          createdAt = (data.createdAt as number) ?? Date.now();
          const aiResults = (data.aiResults as Array<{
            url: string;
            score: number | null;
            status: string;
            error?: string;
          }>) ?? [];
        } catch {
          // ignore cloud read errors
        }

        return Response.json({
          ok: true,
          shootId: id,
          fileUrls,
          email,
          createdAt,
          aiResults,
        });
      },
    },
  },
});
