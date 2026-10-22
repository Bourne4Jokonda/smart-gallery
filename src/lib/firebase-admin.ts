import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let cachedDb: Firestore | null = null;

const PROJECT_ID = "smart-gallery-75599";

/**
 * Service account credentials come from the FIREBASE_SERVICE_ACCOUNT env var.
 * Accepts either raw JSON or base64-encoded JSON (base64 is what Vercel stores cleanly).
 */
function readServiceAccount(): Record<string, string> | null {
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();

  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed) as Record<string, string>;
    } catch {
      return null;
    }
  }

  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf-8");
    return JSON.parse(decoded) as Record<string, string>;
  } catch {
    return null;
  }
}

function getAdminApp(): App {
  const sa = readServiceAccount();
  if (!sa) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not configured on the server");
  }
  const existing = getApps();
  if (existing.length > 0) return existing[0]!;
  return initializeApp({
    credential: cert(sa),
    projectId: sa.project_id || PROJECT_ID,
  });
}

/**
 * Admin-level Firestore handle. Bypasses security rules — every read/write through
 * it MUST enforce its own ownership/permission checks in the calling route.
 */
export function getAdminDb(): Firestore {
  if (!cachedDb) cachedDb = getFirestore(getAdminApp());
  return cachedDb;
}
