import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp, type Firestore } from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  type FirebaseStorage,
} from "firebase/storage";

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
let storage: FirebaseStorage | null = null;

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

function getStorageInstance(): FirebaseStorage {
  if (!storage) storage = getStorage(getApp());
  return storage;
}

/** Сохраняет email лида в коллекцию Firestore "leads". */
export async function saveLead(email: string): Promise<void> {
  const source = "landing";
  await addDoc(collection(getDb(), "leads"), {
    email,
    source,
    createdAt: serverTimestamp(),
  });

  // Telegram-уведомление — не блокирует и не ломает сохранение лида.
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

/** Загружает фото клиента в Firebase Storage (папка "uploads"). Возвращает публичный URL. */
export async function uploadClientPhoto(file: File): Promise<string> {
  const path = `uploads/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const snapshot = await uploadBytes(ref(getStorageInstance(), path), file);
  return getDownloadURL(snapshot.ref);
}

export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_FILES = 2000;

export type UploadProgressHandler = (index: number, percent: number) => void;

export interface ShootUploadResult {
  fileUrls: string[];
  shootId: string;
}

/**
 * Загружает файлы съёмки в Storage (uploads/{timestamp}-{email|anon}/{filename})
 * и создаёт документ в коллекции "shoots".
 */
export async function uploadShoot(
  files: File[],
  options: { email?: string | null; consent?: boolean; onProgress?: UploadProgressHandler } = {},
): Promise<ShootUploadResult> {
  const email = options.email?.trim() || "";
  const who = email ? email.replace(/[^\w.@-]/g, "_") : "anon";
  const folder = `uploads/${Date.now()}-${who}`;
  const fileUrls: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    const safeName = file.name.replace(/[^\w.-]/g, "_");
    const task = uploadBytesResumable(
      ref(getStorageInstance(), `${folder}/${i}-${safeName}`),
      file,
      { contentType: file.type || "application/octet-stream" },
    );

    await new Promise<void>((resolve, reject) => {
      task.on(
        "state_changed",
        (snap) => {
          const percent = snap.totalBytes
            ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
            : 0;
          options.onProgress?.(i, percent);
        },
        reject,
        () => {
          options.onProgress?.(i, 100);
          resolve();
        },
      );
    });

    fileUrls.push(await getDownloadURL(task.snapshot.ref));
  }

  const payload: Record<string, unknown> = {
    email: email || "anon",
    fileCount: files.length,
    fileUrls,
    status: "uploaded",
    createdAt: serverTimestamp(),
    source: "upload-page",
  };
  if (options.consent) {
    payload["consent"] = true;
    payload["consentAt"] = serverTimestamp();
  }

  const doc = await addDoc(collection(getDb(), "shoots"), payload);

  return { fileUrls, shootId: doc.id };
}
