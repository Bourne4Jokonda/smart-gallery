import { createSign } from "node:crypto";

/**
 * Server-side Firestore access with a service account.
 *
 * Implemented on the plain REST API + a self-signed JWT instead of
 * firebase-admin: the admin SDK pulls a CommonJS bundle that breaks under
 * Vercel's ESM output ("__dirname is not defined in ES module scope").
 *
 * Requests signed with the service account's OAuth token are authorized by
 * IAM and therefore BYPASS Firestore Security Rules — every caller of this
 * module must enforce its own ownership checks.
 */

const PROJECT_ID = "smart-gallery-75599";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const SCOPE = "https://www.googleapis.com/auth/cloud-platform";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();

  const parse = (text: string): ServiceAccount | null => {
    try {
      const obj = JSON.parse(text) as ServiceAccount;
      if (obj.client_email && obj.private_key) return obj;
      return null;
    } catch {
      return null;
    }
  };

  if (trimmed.startsWith("{")) return parse(trimmed);
  try {
    return parse(Buffer.from(trimmed, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.value;

  const sa = readServiceAccount();
  if (!sa) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not configured on the server");
  }

  const issuedAt = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = base64url(signer.sign(sa.private_key));
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!res.ok || !json.access_token) {
    throw new Error(`Firebase auth failed: ${res.status} ${JSON.stringify(json).slice(0, 200)}`);
  }
  cachedToken = {
    value: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600) * 1000 - 60_000,
  };
  return cachedToken.value;
}

// ---------- Firestore REST value encoding/decoding ----------

type FirestoreValue = Record<string, unknown>;

function encodeValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === "object") {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      fields[k] = encodeValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function decodeValue(value: FirestoreValue | undefined): unknown {
  if (!value) return undefined;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) {
    const t = new Date(String(value.timestampValue));
    return t.getTime();
  }
  if ("arrayValue" in value) {
    const arr = (value.arrayValue as { values?: FirestoreValue[] } | undefined)?.values ?? [];
    return arr.map(decodeValue);
  }
  if ("mapValue" in value) {
    const fields = (value.mapValue as { fields?: Record<string, FirestoreValue> } | undefined)?.fields ?? {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) out[k] = decodeValue(v);
    return out;
  }
  return undefined;
}

function decodeDocument(doc: unknown): Record<string, unknown> | null {
  if (!doc || typeof doc !== "object") return null;
  const fields = (doc as { fields?: Record<string, FirestoreValue> }).fields ?? {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decodeValue(v);
  return out;
}

// ---------- Public API ----------

export type AdminDocument = Record<string, unknown>;

/** Read one document. Returns null when it does not exist. */
export async function adminGetDoc(
  collection: string,
  docId: string,
): Promise<AdminDocument | null> {
  const token = await getAccessToken();
  const res = await fetch(`${FIRESTORE_BASE}/${collection}/${encodeURIComponent(docId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firestore read failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return decodeDocument(json);
}

/** Create or overwrite a document. */
export async function adminSetDoc(
  collection: string,
  docId: string,
  data: Record<string, unknown>,
  merge = false,
): Promise<void> {
  const token = await getAccessToken();
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(data)) fields[k] = encodeValue(v);

  if (!merge) {
    const res = await fetch(
      `${FIRESTORE_BASE}/${collection}/${encodeURIComponent(docId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Firestore write failed: ${res.status} ${text.slice(0, 200)}`);
    }
    return;
  }

  const mask = Object.keys(data)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&");
  const res = await fetch(
    `${FIRESTORE_BASE}/${collection}/${encodeURIComponent(docId)}?${mask}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firestore merge failed: ${res.status} ${text.slice(0, 200)}`);
  }
}

/** Create a document with a generated id. */
export async function adminAddDoc(
  collection: string,
  data: Record<string, unknown>,
): Promise<string> {
  const token = await getAccessToken();
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(data)) fields[k] = encodeValue(v);
  const res = await fetch(`${FIRESTORE_BASE}/${collection}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firestore add failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { name?: string };
  return json.name?.split("/").pop() ?? "";
}

/** Delete a document. */
export async function adminDeleteDoc(
  collection: string,
  docId: string,
): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${FIRESTORE_BASE}/${collection}/${encodeURIComponent(docId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firestore delete failed: ${res.status} ${text.slice(0, 200)}`);
  }
}

/** Query documents where a field equals a value. */
export async function adminQueryByField(
  collection: string,
  field: string,
  value: string,
  limit = 1,
): Promise<AdminDocument[]> {
  const token = await getAccessToken();
  const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: {
          fieldFilter: {
            field: { fieldPath: field },
            op: "EQUAL",
            value: { stringValue: value },
          },
        },
        limit,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firestore query failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const rows = (await res.json()) as Array<{ document?: unknown }>;
  const out: AdminDocument[] = [];
  for (const row of rows) {
    const doc = decodeDocument(row.document);
    if (doc) out.push(doc);
  }
  return out;
}
