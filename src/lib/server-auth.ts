import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Server-side helpers for routes that must prove the caller owns a shoot.
 *
 * The client sends its Firebase ID token in the `Authorization: Bearer ...`
 * header. We verify it with the Identity Toolkit REST API (no extra deps) and
 * then check the shoot's `userId` against the verified uid.
 */

const FIREBASE_API_KEY = process.env["VITE_FIREBASE_API_KEY"] ?? "";

export function extractBearer(request: Request): string {
  const h = request.headers.get("authorization") ?? "";
  if (h.startsWith("Bearer ")) return h.slice(7).trim();
  return "";
}

/** Verify a Firebase ID token -> uid, or null when the token is missing/invalid. */
export async function verifyIdToken(idToken: string): Promise<string | null> {
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

/**
 * Constant-time string compare (timingSafeEqual needs equal-length buffers).
 */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHmac("sha256", "sg-compare").update(a).digest();
  const hb = createHmac("sha256", "sg-compare").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Verify that the bearer token belongs to the owner of the given shoot.
 * Returns the owner uid on success, otherwise null.
 */
export async function verifyShootOwner(
  request: Request,
  shootId: string,
): Promise<string | null> {
  const uid = await verifyIdToken(extractBearer(request));
  if (!uid) return null;
  try {
    const { adminGetDoc } = await import("@/lib/firestore-admin");
    const data = await adminGetDoc("shoots", shootId);
    if (!data) return null;
    const ownerId = data.userId;
    if (typeof ownerId !== "string" || ownerId !== uid) return null;
    return uid;
  } catch {
    return null;
  }
}
