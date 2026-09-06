import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp, type Firestore } from "firebase/firestore";

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

function getDb(): Firestore {
  if (!db) db = getFirestore(getApp());
  return db;
}

/** Сохраняет email лида в коллекцию Firestore "leads". */
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

export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_FILES = 2000;
