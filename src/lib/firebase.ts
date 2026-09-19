import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs,
  where,
  doc,
  getDoc,
  type Firestore,
} from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env["VITE_FIREBASE_API_KEY"],
  authDomain: import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"],
  projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"],
  storageBucket: import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"],
  messagingSenderId: import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"],
  appId: import.meta.env["VITE_FIREBASE_APP_ID"],
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let authInstance: ReturnType<typeof getAuth> | null = null;

function getApp(): FirebaseApp {
  if (!app) {
    const existing = getApps();
    app = existing.length > 0 ? existing[0]! : initializeApp(firebaseConfig);
  }
  return app;
}

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

export function getDb(): Firestore {
  if (!db) db = getFirestore(getApp());
  return db;
}

export function getAuthInstance() {
  if (!authInstance) authInstance = getAuth(getApp());
  return authInstance;
}

export function onUserChange(cb: (user: User | null) => void) {
  const auth = getAuthInstance();
  return onAuthStateChanged(auth, cb);
}

export async function signIn(email: string, password: string) {
  const auth = getAuthInstance();
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUp(email: string, password: string) {
  const auth = getAuthInstance();
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
  const auth = getAuthInstance();
  return signOut(auth);
}

export async function saveLead(email: string): Promise<void> {
  const source = "landing";
  await addDoc(collection(getDb(), "leads"), {
    email,
    source,
    createdAt: serverTimestamp(),
  });

  try {
    await fetch("/api/notify-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source }),
    });
  } catch (error) {
    console.warn(
      "Telegram-уведомление не отправлено (лид сохранён):",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function saveShootRecord(record: Record<string, unknown>) {
  const auth = getAuthInstance();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Требуется авторизация");
  }
  const payload = {
    ...record,
    userId: user.uid,
    createdAt: serverTimestamp(),
  };
  await addDoc(collection(getDb(), "shoots"), payload as Record<string, unknown>);
}

export async function saveShootRecordById(
  shootId: string,
  record: Record<string, unknown>,
) {
  const auth = getAuthInstance();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Требуется авторизация");
  }
  const ref = doc(getDb(), "shoots", shootId);
  await import("firebase/firestore").then(({ setDoc }) =>
    setDoc(
      ref,
      {
        ...record,
        userId: user.uid,
        createdAt: serverTimestamp(),
      },
      { merge: true },
    ),
  );
}

export async function updateShootRecord(
  shootId: string,
  patch: Record<string, unknown>,
) {
  const db = getDb();
  const ref = doc(db, "shoots", shootId);
  await import("firebase/firestore").then(({ setDoc }) =>
    setDoc(ref, patch, { merge: true }),
  );
}

export async function getUserShoots(userId: string, maxDocs = 50) {
  const db = getDb();
  const q = query(
    collection(db, "shoots"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(maxDocs),
  );
  const snapshot = await getDocs(q);
  const shoots: Array<{
    shootId: string;
    fileUrls: string[];
    email?: string | null;
    createdAt: number;
    aiResults?: Array<{ url: string; score: number | null; status: string; error?: string }>;
    public?: boolean;
  }> = [];
  snapshot.forEach((d) => {
    const data = d.data();
    const rawTs = data["createdAt"];
    let createdAt: number;
    if (rawTs && typeof (rawTs as { toMillis?: () => number }).toMillis === "function") {
      createdAt = (rawTs as { toMillis: () => number }).toMillis();
    } else if (typeof rawTs === "number") {
      createdAt = rawTs;
    } else {
      createdAt = Date.now();
    }
    shoots.push({
      shootId: d.id,
      fileUrls: (data["fileUrls"] as string[]) ?? [],
      email: (data["email"] as string | undefined) ?? null,
      createdAt,
      aiResults: (data["aiResults"] as Array<{ url: string; score: number | null; status: string; error?: string }>) ?? [],
      public: Boolean(data["public"]),
    });
  });
  return shoots;
}

export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_FILES = 2000;
