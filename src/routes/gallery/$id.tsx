import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, useParams } from "@tanstack/react-router";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  Images,
  Loader2,
  Sparkles,
  X,
  Trash2,
  RefreshCcw,
  AlertCircle,
} from "lucide-react";
import JSZip from "jszip";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { getAuthInstance, onUserChange, getDb } from "@/lib/firebase";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { saveShoot, readShoots } from "@/lib/storage";
import { saveShootRecord, saveShootRecordById, updateShootRecord } from "@/lib/firebase";
import { getPublicIdFromUrl } from "@/lib/cloudinary";

interface ShootRecord {
  shootId: string;
  fileUrls: string[];
  email?: string | null;
  createdAt: number;
  aiResults?: Array<{
    url: string;
    score: number | null;
    status: string;
    error?: string;
  }>;
}

function filenameFromUrl(url: string, index: number): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop() ?? "";
    if (last && /\.(jpe?g|png|webp|heic|avif|gif)$/i.test(last)) {
      return last;
    }
  } catch {
    // ignore
  }
  return `photo-${String(index + 1).padStart(3, "0")}.jpg`;
}

async function downloadAsZip(
  urls: string[],
  shootId: string,
  onProgress?: (done: number, total: number) => void,
) {
  const zip = new JSZip();
  const folder = zip.folder(`smart-gallery-${shootId.slice(-6)}`) ?? zip;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!;
    const name = filenameFromUrl(url, i);
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      folder.file(name, blob);
    } catch (err) {
      console.error("zip fetch failed", url, err);
    }
    onProgress?.(i + 1, urls.length);
  }

  const archive = await folder.generateAsync(
    { type: "blob", compression: "STORE" },
    () => {},
  );
  const archiveUrl = URL.createObjectURL(archive);
  const a = document.createElement("a");
  a.href = archiveUrl;
  a.download = `smart-gallery-${shootId.slice(-6)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(archiveUrl), 1000);
}

async function downloadSinglePhoto(url: string, index: number) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `photo-${String(index + 1).padStart(3, "0")}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  } catch (err) {
    console.error("single photo download failed", url, err);
    throw err;
  }
}

export const Route = createFileRoute("/gallery/$id")({
  component: GalleryPage,
  errorComponent: GalleryError,
});

function GalleryError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <div className="mx-auto max-w-2xl px-5 py-20 text-center sm:px-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Галерея не загрузилась</h1>
        <p className="mt-3 text-sm text-muted-foreground">Попробуйте обновить страницу или открыть съёмку из кабинета.</p>
        <button onClick={reset} className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Обновить</button>
      </div>
    </div>
  );
}

function GalleryPage() {
  const { id = "" } = useParams({ strict: false }) as { id?: string };
  const [record, setRecord] = useState<ShootRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState({ done: 0, total: 0 });
  const [singleDownloading, setSingleDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<"all" | "best">("all");
  const [curating, setCurating] = useState(false);
  const [curateProgress, setCurateProgress] = useState({ done: 0, total: 0 });
  const [publicGallery, setPublicGallery] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (showHint) {
      timer = setTimeout(() => setShowHint(false), 3500);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showHint]);

  const publicUrl = useMemo(() => {
    if (!record || !publicGallery) return "";
    return `${window.location.origin}/public-gallery/${record.shootId}`;
  }, [record, publicGallery]);

  const bestUrls = useMemo(() => {
    if (!record) return [];
    if (filter !== "best") return [];
    return record.aiResults
      ?.filter((r) => r.status === "ok" && r.score != null && r.score >= 7)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .map((r) => r.url) ?? [];
  }, [record, filter]);

  const visibleUrls = useMemo(() => {
    if (!record) return [];
    if (filter === "best" && bestUrls.length > 0) return bestUrls;
    return record.fileUrls;
  }, [record, filter, bestUrls]);

  const normalizeUrl = (url: string) =>
    url.replace(/\/$/, "").split("?")[0];

  const isBest = (url: string) => bestUrls.some((u) => normalizeUrl(u) === normalizeUrl(url));

  useEffect(() => {
    const shoots = readShoots();
    const local = shoots[id] ?? null;
    if (local) {
      setRecord(local);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const loadFromCloud = async () => {
      try {
        const auth = getAuthInstance();
        const user = auth.currentUser;
        if (!user) {
          setLoading(false);
          return;
        }
        const db = getDb();
        const shootRef = doc(db, "shoots", id);
        const snap = await getDoc(shootRef);
        if (!snap.exists() || cancelled) {
          setLoading(false);
          return;
        }
        const data = snap.data() as Record<string, unknown>;
        const cloudRecord: ShootRecord = {
          shootId: id,
          fileUrls: (data.fileUrls as string[]) ?? [],
          email: (data.email as string | undefined) ?? user.email ?? "",
          createdAt: (data.createdAt as number) ?? Date.now(),
          aiResults: (data.aiResults as ShootRecord["aiResults"]) ?? [],
        };
        setRecord(cloudRecord);
      } catch {
        // ignore cloud read errors
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadFromCloud();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Lightbox: lock body scroll + keyboard nav
  useEffect(() => {
    if (lightboxIndex === null) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (!record) return;
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowRight") {
        setLightboxIndex((i) =>
          i === null ? null : (i + 1) % record.fileUrls.length,
        );
      }
      if (e.key === "ArrowLeft") {
        setLightboxIndex((i) =>
          i === null
            ? null
            : (i - 1 + record.fileUrls.length) % record.fileUrls.length,
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightboxIndex, record]);

  const handleDownloadZip = useCallback(async () => {
    if (!record || zipping) return;
    setZipping(true);
    setZipProgress({ done: 0, total: record.fileUrls.length });
    const toastId = toast.loading("Собираем ZIP…");
    try {
      await downloadAsZip(record.fileUrls, record.shootId, (done, total) =>
        setZipProgress({ done, total }),
      );
      toast.success(
        `ZIP готов — ${record.fileUrls.length} фото`,
        { id: toastId },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      toast.error("Не удалось собрать ZIP", { id: toastId, description: message });
    } finally {
      setZipping(false);
    }
  }, [record, zipping]);

  const handleDownloadSingle = useCallback(async () => {
    if (!record || lightboxIndex === null || singleDownloading) return;
    const url = record.fileUrls[lightboxIndex];
    if (!url) return;
    try {
      setSingleDownloading(true);
      await downloadSinglePhoto(url, lightboxIndex);
      toast.success("Фото сохранено");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      toast.error("Не удалось скачать фото", { description: message });
    } finally {
      setSingleDownloading(false);
    }
  }, [record, lightboxIndex, singleDownloading, zipping]);

  const deleteCurrentImage = useCallback(async () => {
    if (!record || lightboxIndex === null || deleting) return;
    const url = record.fileUrls[lightboxIndex];
    if (!url) return;
    const publicId = getPublicIdFromUrl(url);
    if (!publicId) {
      toast.error("Не удалось определить идентификатор файла для удаления");
      return;
    }
    if (
      !confirm(
        "Удалить это фото из Cloudinary?\n\nЭто необратимо: файл исчезнет из облака и из этой съёмки."
      )
    )
      return;
    setDeleting(true);
    try {
      const res = await fetch("/api/delete-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Ошибка удаления: ${res.status} ${text.slice(0,200)}`);
      }
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || "Неизвестная ошибка");
      }
      // Remove from fileUrls and aiResults
      const newFileUrls = record.fileUrls.filter((u, idx) => idx !== lightboxIndex);
      const newAiResults = (record.aiResults ?? []).filter((r) => r.url !== url);
      const updated = { ...record, fileUrls: newFileUrls, aiResults: newAiResults };
      setRecord(updated);
      saveShoot(updated);
      try {
        await updateShootRecord(record.shootId, {
          fileUrls: newFileUrls,
          aiResults: newAiResults,
        });
      } catch {
        // ignore cloud write errors
      }
      toast.success("Фото удалено");
      if (newFileUrls.length === 0) {
        setLightboxIndex(null);
      } else {
        if (lightboxIndex >= newFileUrls.length) {
          setLightboxIndex(newFileUrls.length - 1);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      toast.error("Не удалось удалить фото", { description: message });
    } finally {
      setDeleting(false);
    }
  }, [record, lightboxIndex, deleting, saveShoot, updateShootRecord]);

  const deleteImageAt = useCallback(async (idx: number) => {
    if (!record || deleting) return;
    const url = record.fileUrls[idx];
    if (!url) return;
    const publicId = getPublicIdFromUrl(url);
    if (!publicId) {
      toast.error("Не удалось определить файл для удаления");
      return;
    }
    if (
      !confirm(
        "Удалить это фото из Cloudinary?\n\nЭто необратимо: файл исчезнет из облака и из этой съёмки."
      )
    )
      return;
    setDeleting(true);
    try {
      const res = await fetch("/api/delete-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Ошибка: ${res.status} ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || "Не удалось удалить фото");
      }
      const newFileUrls = record.fileUrls.filter((u, i) => i !== idx);
      const newAiResults = (record.aiResults ?? []).filter((r) => r.url !== url);
      const updated = { ...record, fileUrls: newFileUrls, aiResults: newAiResults };
      setRecord(updated);
      saveShoot(updated);
      try {
        await updateShootRecord(record.shootId, { fileUrls: newFileUrls, aiResults: newAiResults });
      } catch {
        // ignore
      }
      toast.success("Фото удалено");
      setLightboxIndex((lb) =>
        lb !== null && lb >= newFileUrls.length ? newFileUrls.length - 1 : lb,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка удаления";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }, [record, deleting, saveShoot, updateShootRecord]);
  const runCurate = useCallback(async () => {
    if (!record || curating) return;
    const urls = record.fileUrls;
    if (!urls.length) {
      toast.error("Нет фото для AI-отбора");
      return;
    }
    setCurating(true);
    setCurateProgress({ done: 0, total: urls.length });
    setShowHint(true);
    const toastId = toast.loading(`AI-отбор: ${urls.length} фото…`);
    console.log("[runCurate] starting", { urls, recordId: record.shootId });
    try {
      const res = await fetch("/api/curate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shootId: record.shootId, fileUrls: urls }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Ошибка: ${res.status} ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as { ok: boolean; results?: Array<{ url: string; score: number | null; status: string; error?: string }> };
      console.log("[runCurate] response data:", data);
      if (!data.ok || !Array.isArray(data.results)) {
        throw new Error(data?.error || "AI не вернул результаты");
      }
      const incoming = new Map(
        data.results.map((r) => [
          r.url,
          {
            url: r.url,
            score: r.score,
            status: r.status,
            ...(r.error ? { error: r.error } : {}),
          },
        ]),
      );
      const merged = (record.aiResults ?? []).map((old) => {
        const next = incoming.get(old.url);
        if (!next) return old;
        // Keep existing ok scores; replace errors or empty statuses
        if (old.status === "ok" && old.score != null) {
          return old;
        }
        return next;
      });
      for (const [url, result] of incoming) {
        if (!merged.some((item) => item.url === url)) {
          merged.push(result);
        }
      }
      const aiResults = merged;
      const updated = { ...record, aiResults };
      setRecord(updated);
      saveShoot(updated);
      try {
        await updateShootRecord(record.shootId, { aiResults });
      } catch {
        // ignore cloud write errors
      }
      const scored = aiResults.filter((a) => a.score != null).length;
      const errored = aiResults.filter((a) => a.status === "error").length;
      const unscored = urls.length - scored - errored;
      setCurateProgress({ done: scored, total: urls.length });
      if (errored > 0) {
        toast.warning(`AI-отбор: ${scored} оценено, ${errored} ошибок, ${unscored} без оценки`, { id: toastId });
      } else if (unscored > 0) {
        toast.warning(`AI-отбор: ${scored} оценено, ${unscored} не оценено`, { id: toastId });
      } else {
        toast.success(`AI-отбор завершён: ${scored}/${urls.length} фото оценены`, { id: toastId });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      toast.error("Не удалось запустить AI-отбор", { id: toastId, description: message });
    } finally {
      setCurating(false);
      setCurateProgress({ done: 0, total: 0 });
    }
  }, [record, curating, saveShoot, updateShootRecord]);

  const reindexSingleImage = useCallback(async (url: string) => {
    if (!record || curating) return;
    const toastId = toast.loading("Переоценка фото…");
    setCurating(true);
    try {
      const res = await fetch("/api/curate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shootId: record.shootId, fileUrls: [url] }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Ошибка: ${res.status} ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as { ok: boolean; results?: Array<{ url: string; score: number | null; status: string; error?: string }> };
      if (!data.ok || !Array.isArray(data.results) || !data.results[0]) {
        throw new Error(data?.error || "AI не вернул результат");
      }
      const result = data.results[0];
      const updated = {
        ...record,
        aiResults: (record.aiResults ?? []).map((item) =>
          item.url === url ? { url, score: result.score, status: result.status, ...(result.error ? { error: result.error } : {}) } : item,
        ),
      };
      setRecord(updated);
      saveShoot(updated);
      try {
        await updateShootRecord(record.shootId, { aiResults: updated.aiResults });
      } catch {
        // ignore
      }
      if (result.status === "ok" && result.score != null) {
        toast.success(`Оценка: ${result.score}/10`, { id: toastId });
      } else {
        toast.error(result.error || "Не удалось переоценить фото", { id: toastId });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка переоценки";
      toast.error(message, { id: toastId });
    } finally {
      setCurating(false);
    }
  }, [record, curating, saveShoot, updateShootRecord]);

  const clearCloudinaryFolder = useCallback(async () => {
    if (!record) return;
    if (!record.email) {
      toast.error(
        "Невозможно очистить папку: email не сохранён в этой сессии. Загрузите съёмку заново, авторизовавшись."
      );
      return;
    }
    if (
      !confirm(
        `Удалить ВСЕ файлы этой сесси из Cloudinary?\nПапка: smart-gallery/${record.email}/${record.shootId}\nЭто необратимо. Продолжить?`
      )
    )
      return;
    setDeleting(true);
    const toastId = toast.loading("Очищаем папку Cloudinary…");
    try {
      const res = await fetch("/api/delete-shoot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: record.email, shootId: record.shootId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || `Ошибка: ${res.status}`);
      }
      toast.success(
        `Удалено из Cloudinary: ${data.deleted ?? "?"} файлов. Папка: ${data.folderDeleted ? "удалена" : "(осталась — не пустая)"}`.trim(),
        { id: toastId }
      );
      // Remove all fileUrls from the shoot record (local + Firestore)
      const updated = { ...record, fileUrls: [], aiResults: [] };
      setRecord(updated);
      saveShoot(updated);
      try {
        await updateShootRecord(record.shootId, { fileUrls: [], aiResults: [] });
      } catch {}
      setLightboxIndex(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка очистки";
      toast.error("Не удалось очистить папку", { id: toastId, description: message });
    } finally {
      setDeleting(false);
    }
  }, [record, deleting, saveShoot, updateShootRecord]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-screen bg-background text-foreground antialiased">
        <header className="border-b border-border px-5 py-4 sm:px-8">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-2 font-bold tracking-tight"
            >
              <span className="inline-flex rounded-lg bg-primary p-1.5">
                <Camera className="h-4 w-4 text-primary-foreground" />
              </span>
              Умная галерея
            </Link>
            <Link
              to="/upload"
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              Загрузить ещё
            </Link>
          </div>
        </header>
        <main className="px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-10 text-center">
            <Images className="mx-auto h-12 w-12 text-muted-foreground" />
            <h1 className="mt-5 text-2xl font-bold sm:text-3xl">
              Съёмка не найдена
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Ссылка устарела или была открыта в другом браузере. Съёмки
              сохраняются локально — откройте её на том же устройстве, где
              загружали.
            </p>
            <Link
              to="/upload"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110"
            >
              <Sparkles className="h-4 w-4" />
              Загрузить новую съёмку
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const date = new Date(record.createdAt);
  const dateStr = date.toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <main className="px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <div className="sticky top-0 z-30 -mx-5 bg-background/90 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Link
                  to="/profile"
                  className="inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-primary"
                >
                  <ChevronLeft className="h-3 w-3" />
                  Назад к сессиям
                </Link>
                <p className="text-xs font-medium uppercase tracking-wider text-primary">
                  Съёмка #{record.shootId.slice(-6)}
                </p>
                <h1 className="mt-1 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Загружено {record.fileUrls.length}{" "}
                  {record.fileUrls.length === 1 ? "фото" : "фото"}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {dateStr}
                  {record.email ? ` · ${record.email}` : " · без email"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadZip}
                disabled={zipping || record.fileUrls.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {zipping ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    {zipProgress.total > 0
                      ? `Скачиваем ${zipProgress.done} / ${zipProgress.total}`
                      : "Собираем…"}
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 text-primary" />
                    Скачать всё (ZIP)
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setPublicGallery((v) => !v)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {publicGallery ? "Сделать приватной" : "Сделать публичной"}
              </button>
              <button
                              type="button"
                              onClick={clearCloudinaryFolder}
                              disabled={deleting || !record.email}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-card px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Trash2 className="h-4 w-4" />
                              Очистить папку Cloudinary
                            </button>
                          </div>
                        </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              disabled={filter === "all"}
              className={`px-3 py-1.5 text-sm font-medium rounded-border ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
            >
              Все
            </button>
            <button
              type="button"
              onClick={() => setFilter("best")}
              disabled={filter === "best"}
              className={`px-3 py-1.5 text-sm font-medium rounded-border ${filter === "best" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
            >
              Лучшие
            </button>
          </div>

          {publicGallery && publicUrl && (
            <div className="mt-4 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-center">
              <p className="text-sm font-semibold">Публичная ссылка</p>
              <p className="mt-2 break-all text-xs text-muted-foreground">{publicUrl}</p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(publicUrl);
                    toast.success("Ссылка скопирована");
                  } catch {
                    toast.error("Не удалось скопировать ссылку");
                  }
                }}
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
              >
                <Copy className="h-4 w-4" />
                Скопировать ссылку
              </button>
            </div>
          )}

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {visibleUrls.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className={`group relative aspect-square overflow-hidden rounded-2xl border bg-muted transition-transform hover:scale-[1.02] ${
                    isBest(url) ? "border-primary" : "border-border"
                  }`}
                  aria-label={`Открыть кадр ${i + 1}`}
                >
                  <img
                    src={url}
                    alt={`Кадр ${i + 1}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteImageAt(i);
                    }}
                    disabled={deleting}
                    className="absolute top-1.5 right-1.5 rounded-full bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed"
                    aria-label={`Удалить кадр ${i + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-3 text-left">
                    <p className="text-xs font-semibold">Кадр {i + 1}</p>
                    {(() => {
                        const match = record?.aiResults?.find((r) => normalizeUrl(r.url) === normalizeUrl(url));
                        if (match?.score != null) {
                          return (
                            <p className={`text-xs font-bold ${isBest(url) ? "text-primary" : "text-muted-foreground"}`}>
                              AI: {match.score}/10
                            </p>
                          );
                        }
                        if (match?.status === "error") {
                          const isQuota = /Превышен лимит Gemini/i.test(match.error ?? "");
                          return (
                            <div className={`inline-flex items-center gap-1 text-xs font-bold ${isQuota ? "text-amber-500" : "text-destructive"}`}>
                              {isQuota ? <RefreshCcw className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                              <span className="sr-only">{isQuota ? "Превышен лимит Gemini, требуется повтор" : "Ошибка оценки"}</span>
                            </div>
                          );
                        }
                        return <p className="text-xs font-bold text-muted-foreground">AI: —</p>;
                      })()}
                  </div>
                  {(() => {
                    const match = record?.aiResults?.find((r) => normalizeUrl(r.url) === normalizeUrl(url));
                    const needsRetry = !match || match.status === "error" || (match.score == null && match.status !== "ok");
                    if (!needsRetry) return null;
                    return (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          reindexSingleImage(url);
                        }}
                        disabled={curating}
                        className="absolute top-1.5 left-1.5 rounded-full bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed"
                        aria-label={`Переоценить кадр ${i + 1}`}
                      >
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                      </button>
                    );
                  })()}
                </button>
              ))}
            </div>

          <div className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2">
                      <div className="group relative flex flex-col items-center gap-2">
                        {showHint && (
                          <span className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-2">
                              <RefreshCcw className="h-3.5 w-3.5" />
                              <span>Если видите ошибку — подождите 1–2 минуты и снова запустите AI-отбор.</span>
                            </span>
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={runCurate}
                          disabled={curating || !record?.fileUrls?.length}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {curating ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Оцениваем…
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              {record?.aiResults?.length ? "Перезапустить AI-отбор" : "Запустить AI-отбор"}
                            </>
                          )}
                        </button>
                      </div>
                      {curating && (
                        <div className="mt-2 text-center text-[11px] text-muted-foreground">
                          {curateProgress.done} / {curateProgress.total}
                        </div>
                      )}
                    </div>
        </div>
      </main>

      <footer className="border-t border-border px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div>
            <Link
              to="/privacy"
              className="text-sm text-muted-foreground hover:text-primary hover:underline"
            >
              Политика конфиденциальности
            </Link>
            <p className="mt-2 text-xs text-muted-foreground/60">
              © 2026 Умная галерея для фотографов
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Вопросы?{" "}
            <a
              href="https://t.me/ai_gallery_helper"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              @ai_gallery_helper
            </a>
          </p>
        </div>
      </footer>

      {/* LIGHTBOX */}
      {lightboxIndex !== null && record.fileUrls[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
          onClick={() => setLightboxIndex(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative inline-block max-w-[90vw] max-h-[85vh]">
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  reindexSingleImage(currentUrl);
                }}
                disabled={curating}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/80 text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-70"
                aria-label="Переоценить кадр"
              >
                <Sparkles className="h-5 w-5" />
              </button>
            </div>
            <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(null);
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/80 text-foreground transition-colors hover:border-primary hover:text-primary"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {record.fileUrls.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex(
                      (lightboxIndex - 1 + record.fileUrls.length) %
                        record.fileUrls.length,
                    );
                  }}
                  className="absolute -left-10 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/80 text-foreground transition-colors hover:border-primary hover:text-primary"
                  aria-label="Предыдущее фото"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex((lightboxIndex + 1) % record.fileUrls.length);
                  }}
                  className="absolute -right-10 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/80 text-foreground transition-colors hover:border-primary hover:text-primary"
                  aria-label="Следующее фото"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            <img
              src={record.fileUrls[lightboxIndex]}
              alt={`Кадр ${lightboxIndex + 1}`}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            />

            {(() => {
                          const currentUrl = record.fileUrls[lightboxIndex];
                          const match = record.aiResults?.find((r) => normalizeUrl(r.url) === normalizeUrl(currentUrl));
                          return (
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card/80 px-4 py-1.5 text-xs font-medium text-foreground pointer-events-none">
                              {match?.score != null ? `AI: ${match.score}/10` : `Кадр ${lightboxIndex + 1}`}
                            </div>
                          );
                        })()}

            <div className="absolute -bottom-8 left-1/2 flex -translate-x-1/2 items-center whitespace-nowrap justify-center gap-2 rounded-full border border-border bg-card/80 px-4 py-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteCurrentImage();
                }}
                disabled={deleting || !record || lightboxIndex === null}
                className="inline-flex items-center justify-center rounded-full p-1.5 text-xs text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-70"
                aria-label="Удалить из Cloudinary"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadSingle();
                }}
                disabled={singleDownloading}
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Download className="h-4 w-4" />
                {singleDownloading ? "Скачиваем…" : "Скачать это фото"}
              </button>
              <div className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-foreground">
                {lightboxIndex + 1} / {record.fileUrls.length}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
