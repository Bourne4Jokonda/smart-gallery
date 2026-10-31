import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  MessageSquareText,
} from "lucide-react"
import JSZip from "jszip";
import { toast } from "sonner";
import { SpeedDial } from "../../components/SpeedDial";
import { getAuthInstance, onUserChange, getDb, getIdToken } from "@/lib/firebase";
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const currentLightboxIndex = useMemo(() => {
    if (lightboxUrl === null || !record) return null;
    return record.fileUrls.findIndex((u) => u === lightboxUrl);
  }, [lightboxUrl, record]);

  const openLightbox = (url: string) => setLightboxUrl(url);
  const closeLightbox = () => setLightboxUrl(null);

  const lightboxNext = () => {
    if (!record || currentLightboxIndex == null) return;
    const next = (currentLightboxIndex + 1) % record.fileUrls.length;
    setLightboxUrl(record.fileUrls[next] ?? null);
  };

  const lightboxPrev = () => {
    if (!record || currentLightboxIndex == null) return;
    const prev = (currentLightboxIndex - 1 + record.fileUrls.length) % record.fileUrls.length;
    setLightboxUrl(record.fileUrls[prev] ?? null);
  };
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState({ done: 0, total: 0 });
  const [singleDownloading, setSingleDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<"all" | "best">("all");
  const [curating, setCurating] = useState(false);
  const [curateProgress, setCurateProgress] = useState({ done: 0, total: 0 });
  const [curateExpanded, setCurateExpanded] = useState(false);
  const [publicGallery, setPublicGallery] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // ADD: States for AI description in lightbox
  // Описания кэшируются по URL фото: переключение кадра не теряет уже полученное
  // описание — возвращаясь к кадру, оно показывается сразу, без повторного запроса.
  const [aiDescriptions, setAiDescriptions] = useState<Record<string, { description: string; tags: string[] }>>({});
  const [aiDescriptionLoading, setAiDescriptionLoading] = useState(false);
  const [aiDescriptionError, setAiDescriptionError] = useState<string | null>(null);
  const [aiDescriptionProgress, setAiDescriptionProgress] = useState<{ done: number; total: number } | null>(null);
  const [aiDescriptionExpanded, setAiDescriptionExpanded] = useState(false);

  // Описание текущего кадра (из кэша)
  const aiDescription = lightboxUrl ? aiDescriptions[lightboxUrl] ?? null : null;

  // URL, для которых уже проверяли серверный кэш — чтобы не долбить GET при каждом кадре
  const aiDescriptionsChecked = useRef<Set<string>>(new Set());

useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (showHint) {
      timer = setTimeout(() => setShowHint(false), 3500);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showHint]);

  useEffect(() => {
    if (record) setPublicGallery(Boolean(record.public));
  }, [record?.shootId, record?.public]);

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
          public: (data.public as boolean) ?? false,
          password: (data.password as string | undefined),
          title: (data.title as string | undefined),
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
    if (currentLightboxIndex === null) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (!record) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") lightboxNext();
      if (e.key === "ArrowLeft") lightboxPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [currentLightboxIndex, record, closeLightbox, lightboxNext, lightboxPrev]);

  // При смене кадра чистим только ошибку. Само описание хранится в кэше по URL,
  // поэтому уже полученное описание не пропадает и не запрашивается заново.
  useEffect(() => {
    setAiDescriptionError(null);
  }, [currentLightboxIndex]);

  // При смене кадра подтягиваем описание из серверного кэша (Firestore), если оно там
  // уже есть. Без AI-запроса — только чтение кэша, поэтому дёшево и безопасно.
  // Благодаря этому описание сохраняется и между открытиями лайтбокса.
  useEffect(() => {
    if (!lightboxUrl) return;
    if (aiDescriptions[lightboxUrl]) return;          // уже есть в клиентском кэше
    if (aiDescriptionsChecked.current.has(lightboxUrl)) return; // уже проверяли
    aiDescriptionsChecked.current.add(lightboxUrl);

    // Запрос НЕ отменяем при смене кадра: ответ придёт в кэш по своему URL
    // и описание сохранится для того фото, к которому относится.
    const requestedUrl = lightboxUrl;
    fetch(`/api/ai-description?photoUrl=${encodeURIComponent(requestedUrl)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !data.ok || !data.description) return;
        setAiDescriptions((prev) =>
          prev[requestedUrl]
            ? prev
            : {
                ...prev,
                [requestedUrl]: { description: data.description, tags: data.tags ?? [] },
              },
        );
      })
      .catch(() => {
        /* нет кэша / сеть недоступна — описание просто не покажется, кнопка остаётся */
      });
  }, [lightboxUrl, aiDescriptions]);

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
    if (!record || currentLightboxIndex === null || singleDownloading) return;
    const url = record.fileUrls[currentLightboxIndex];
    if (!url) return;
    try {
      setSingleDownloading(true);
      await downloadSinglePhoto(url, currentLightboxIndex);
      toast.success("Фото сохранено");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      toast.error("Не удалось скачать фото", { description: message });
    } finally {
      setSingleDownloading(false);
    }
  }, [record, currentLightboxIndex, singleDownloading, zipping]);

  const deleteCurrentImage = useCallback(async () => {
    if (!record || currentLightboxIndex === null || deleting) return;
    const url = record.fileUrls[currentLightboxIndex];
    if (!url) return;
    const publicId = getPublicIdFromUrl(url);
    if (!publicId) {
      toast.error("Не удалось определить идентификатор файла для удаления");
      return;
    }
    if (
      !confirm(
        "Удалить это фото из Cloudinary?\n\nЭто необратимо: файл исчезнет из облака и из этой съёмки.",
      )
    )
      return;
    setDeleting(true);
    try {
      const res = await fetch("/api/delete-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await getIdToken()) ?? ""}`,
        },
        body: JSON.stringify({ publicId, shootId: record.shootId }),
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
      const newFileUrls = record.fileUrls.filter((u, idx) => idx !== currentLightboxIndex);
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
        setLightboxUrl(null);
      } else {
        if (currentLightboxIndex >= newFileUrls.length) {
          setLightboxUrl(newFileUrls[newFileUrls.length - 1]);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      toast.error("Не удалось удалить фото", { description: message });
    } finally {
      setDeleting(false);
    }
  }, [record, currentLightboxIndex, deleting, saveShoot, updateShootRecord]);

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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await getIdToken()) ?? ""}`,
        },
        body: JSON.stringify({ publicId, shootId: record.shootId }),
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
      setLightboxUrl((lb) =>
        lb !== null && currentLightboxIndex >= newFileUrls.length ? newFileUrls[newFileUrls.length - 1] : lb,
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
    setCurateExpanded(false);
    setShowHint(true);
    const toastId = toast.loading(`AI-отбор: 0/${urls.length} фото…`);
    const BATCH_SIZE = 10;
    try {
      let merged = [...(record.aiResults ?? [])];
      for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);
        const res = await fetch("/api/curate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shootId: record.shootId, fileUrls: batch }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Ошибка: ${res.status} ${text.slice(0, 200)}`);
        }
        const data = (await res.json()) as { ok: boolean; results?: Array<{ url: string; score: number | null; status: string; error?: string }> };
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
        merged = merged.map((old) => {
          const next = incoming.get(old.url);
          if (!next) return old;
          if (old.status === "ok" && old.score != null) return old;
          return next;
        });
        for (const [url, result] of incoming) {
          if (!merged.some((item) => item.url === url)) {
            merged.push(result);
          }
        }
        const scored = merged.filter((a) => a.score != null).length;
        setRecord((prev) => (prev ? { ...prev, aiResults: merged } : prev));
        setCurateProgress({ done: scored, total: urls.length });
        toast.loading(`AI-отбор: ${scored}/${urls.length} фото…`, { id: toastId });
      }
      const updated = { ...record, aiResults: merged };
      setRecord(updated);
      saveShoot(updated);
      try {
        await updateShootRecord(record.shootId, { aiResults: merged });
      } catch {
        // ignore cloud write errors
      }
      const scoredFinal = merged.filter((a) => a.score != null).length;
      const errored = merged.filter((a) => a.status === "error").length;
      const unscored = urls.length - scoredFinal - errored;
      if (errored > 0) {
        toast.warning(`AI-отбор: ${scoredFinal} оценено, ${errored} ошибок, ${unscored} без оценки`, { id: toastId });
      } else if (unscored > 0) {
        toast.warning(`AI-отбор: ${scoredFinal} оценено, ${unscored} не оценено`, { id: toastId });
      } else {
        toast.success(`AI-отбор завершён: ${scoredFinal}/${urls.length} фото оценены`, { id: toastId });
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

  // ADD: Fetch AI description for current photo
  const fetchAiDescription = useCallback(async () => {
    if (!record || currentLightboxIndex === null) return;
    const photoUrl = record.fileUrls[currentLightboxIndex];
    setAiDescriptionLoading(true);
    setAiDescriptionError(null);
    try {
      const response = await fetch("/api/ai-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data.ok) {
        setAiDescriptions((prev) => ({
          ...prev,
          [photoUrl]: {
            description: data.description,
            tags: data.tags,
          },
        }));
        setAiDescriptionError(null);
      } else {
        throw new Error(data.error || "Failed to get AI description");
      }
    } catch (err) {
      setAiDescriptionError(
        err instanceof Error
          ? err.message
          : "Не удалось получить описание фото"
      );
    } finally {
      setAiDescriptionLoading(false);
    }
  }, [record, currentLightboxIndex]);

  // Массовое AI-описание всех фото сессии (SpeedDial → "AI-описание")
  const fetchAllAiDescriptions = useCallback(async () => {
    if (!record) return;
    setAiDescriptionLoading(true);
    setAiDescriptionError(null);
    const urls = record.fileUrls;
    setAiDescriptionProgress({ done: 0, total: urls.length });
    setAiDescriptionExpanded(false);
    const toastId = toast.loading(`AI-описание фото… 0/${urls.length}`);
    let failed = 0;
    try {
      let done = 0;
      for (const url of urls) {
        if (aiDescriptions[url]) {
          done++;
          setAiDescriptionProgress({ done, total: urls.length });
          continue;
        }
        try {
          const res = await fetch("/api/ai-description", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photoUrl: url }),
          });
          const data = await res.json();
          if (data.ok) {
            setAiDescriptions((prev) => ({
              ...prev,
              [url]: { description: data.description, tags: data.tags },
            }));
          } else {
            failed++;
            console.error("ai description failed", url, data.error);
          }
        } catch (err) {
          failed++;
          console.error("ai description failed", url, err);
        }
        done++;
        setAiDescriptionProgress({ done, total: urls.length });
      }
      if (failed > 0) {
        toast.error(`AI-описание: ${failed} фото не удалось`, { id: toastId });
      } else {
        toast.success("AI-описание готово", { id: toastId });
      }
    } finally {
      setAiDescriptionLoading(false);
      setTimeout(() => setAiDescriptionProgress(null), 3000);
    }
  }, [record, aiDescriptions]);

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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await getIdToken()) ?? ""}`,
        },
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
      setLightboxUrl(null);
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
          <div className="sticky top-0 z-30 -mx-5 bg-background/90 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <Link
                  to="/profile"
                  className="back-to-cabinet inline-flex items-center gap-1.5 text-sm font-bold text-primary transition-colors hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Назад в кабинет
                </Link>
                <p className="shoot-title d-kicker mt-0">Съёмка #{record.shootId.slice(-6)}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="d-display text-[clamp(1.4rem,3vw,2rem)]">
                  {record.fileUrls.length} фото{" "}
                  <span className="text-muted-foreground font-normal">·</span>{" "}
                  <span className="text-primary">
                    {record.aiResults?.filter((r) => r.status === "ok" && r.score != null && r.score >= 7).length ?? 0}{" "}
                    лучших
                  </span>
                </h1>
                <div className="inline-flex rounded-full border border-border bg-card p-1">
                  <button
                    type="button"
                    onClick={() => setFilter("all")}
                    className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                      filter === "all"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Все
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter("best")}
                    className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                      filter === "best"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Лучшие
                  </button>
                </div>
              </div>
              {aiDescriptionProgress && (
                <div className="mt-1">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>AI-описание</span>
                    <span>
                      {aiDescriptionProgress.done}/{aiDescriptionProgress.total}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{
                        width: `${aiDescriptionProgress.total ? (aiDescriptionProgress.done / aiDescriptionProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              {curating && curateProgress.total > 0 && (
                <div className="mt-1">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>AI-отбор</span>
                    <span>
                      {curateProgress.done}/{curateProgress.total}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{
                        width: `${curateProgress.total ? (curateProgress.done / curateProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
                {record && record.fileUrls.length > 0 && (() => {
                  const scored = record.aiResults?.filter((a) => a.score != null).length ?? 0;
                  const total = record.fileUrls.length;
                  return (
                    <div className="w-full max-w-xs">
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>AI-отбор</span>
                        <span>{scored}/{total}</span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${total ? (scored / total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>

          <div className="d-photo-grid mt-8">
              {visibleUrls.map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="d-photo-cell group"
                >
                  <img
                    src={url}
                    alt={`Кадр ${i + 1}`}
                    loading="lazy"
                    onClick={() => setLightboxUrl(url)}
                  />
                  {isBest(url) && (
                    <span className="d-best-badge">
                      <Sparkles className="h-3 w-3" />
                      Лучший
                    </span>
                  )}
                  <span className="d-num-badge">{i + 1}</span>
                  {(() => {
                    const match = record?.aiResults?.find((r) => normalizeUrl(r.url) === normalizeUrl(url));
                    if (match?.score != null) {
                      return (
                        <span className={`d-score-badge ${isBest(url) ? "d-pill-on" : ""}`}>
                          AI: {match.score}/10
                        </span>
                      );
                    }
                    if (match?.status === "error") {
                      const isQuota = /Превышен лимит Gemini/i.test(match.error ?? "");
                      return (
                        <span className={`d-score-badge ${isQuota ? "text-amber-500" : "text-destructive"}`}>
                          {isQuota ? <RefreshCcw className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        </span>
                      );
                    }
                    return (
                      <span className="d-score-badge">AI: —</span>
                    );
                  })()}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteImageAt(i);
                    }}
                    disabled={deleting}
                    className="d-cell-action"
                    aria-label={`Удалить кадр ${i + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
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
                        className="d-cell-action d-cell-action-2"
                        aria-label={`Переоценить кадр ${i + 1}`}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </button>
                    );
                  })()}
                </div>
              ))}
            </div>

          {showHint && (
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-lg">
              <span className="inline-flex items-center gap-2">
                <RefreshCcw className="h-3.5 w-3.5" />
                Если видите ошибку — подождите 1–2 минуты и снова запустите AI-отбор.
              </span>
            </div>
          )}
          {/* Компактный индикатор AI-отбора (сворачиваемый) */}
          {curating && curateProgress.total > 0 && (
            <div className="fixed bottom-6 left-6 z-50">
              {!curateExpanded ? (
                <button
                  type="button"
                  onClick={() => setCurateExpanded(true)}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-bold text-foreground shadow-md transition-colors hover:bg-muted/30"
                >
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span>Отбор {curateProgress.done}/{curateProgress.total}</span>
                </button>
              ) : (
                <div className="w-64 rounded-2xl border border-border bg-card p-3 shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">AI-отбор</span>
                    <button
                      type="button"
                      onClick={() => setCurateExpanded(false)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {curateProgress.done}/{curateProgress.total} фото
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{
                        width: `${curateProgress.total ? (curateProgress.done / curateProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Компактный индикатор массового AI-описания (сворачиваемый) */}
          {aiDescriptionProgress && (
            <div className={`fixed ${curating ? "bottom-20" : "bottom-6"} left-6 z-50`}>
              {!aiDescriptionExpanded ? (
                <button
                  type="button"
                  onClick={() => setAiDescriptionExpanded(true)}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-bold text-foreground shadow-md transition-colors hover:bg-muted/30"
                >
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span>AI {aiDescriptionProgress.done}/{aiDescriptionProgress.total}</span>
                </button>
              ) : (
                <div className="w-64 rounded-2xl border border-border bg-card p-3 shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">AI-описание</span>
                    <button
                      type="button"
                      onClick={() => setAiDescriptionExpanded(false)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {aiDescriptionProgress.done}/{aiDescriptionProgress.total} фото
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{
                        width: `${aiDescriptionProgress.total ? (aiDescriptionProgress.done / aiDescriptionProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          {/* SpeedDial with all AI actions, download, public link, delete */}
          <SpeedDial
            shootId={record.shootId}
            hasAiResults={!!record?.aiResults?.length}
            publicUrl={publicUrl}
            loading={{
              curate: curating,
              describe: aiDescriptionLoading,
              download: zipping,
              deleteAll: deleting,
            }}
            onCurate={runCurate}
            onDescribeAll={fetchAllAiDescriptions}
            onDownloadZip={handleDownloadZip}
            onDeleteAll={clearCloudinaryFolder}
          />
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
                                  Вопросы? {" "}
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
                            {lightboxUrl !== null && record.fileUrls[currentLightboxIndex ?? 0] && (
                              <div
                                className="d-lb-overlay d-lb-overlay--stack"
                                onClick={() => setLightboxUrl(null)}
                                role="dialog"
                                aria-modal="true"
                                aria-label="Просмотр фото"
                              >
                                <div className="d-lb-stage d-lb-stage--desc">
                                  {/* Рамка = ширина фото. Описание (absolute, bottom:100%) выезжает из-за фото вверх,
                                      занимает ровно ширину фото и не меняет её. */}
                                  <div className="d-lb-wrap">
                                    {/* AI-описание: отдельный слой НАД фото. Выезжает из-за фото вверх,
                                        ширина фото при этом не меняется. */}
                                    {(aiDescription || aiDescriptionError) && (
                                      <div className="d-lb-desc">
                                        {aiDescription && (
                                          <div className="d-ai-desc-text">
                                            <Sparkles className="h-3 w-3 text-primary" />
                                            <p>{aiDescription.description}</p>
                                          </div>
                                        )}
                                        {aiDescription?.tags && aiDescription.tags.length > 0 && (
                                          <div className="d-ai-desc-tags">
                                            {aiDescription.tags.map((tag, idx) => (
                                              <span key={idx} className="d-ai-tag">#{tag}</span>
                                            ))}
                                          </div>
                                        )}
                                        {aiDescriptionError && (
                                          <div className="d-ai-desc-error">
                                            <AlertCircle className="h-3 w-3" />
                                            <p className="text-xs text-destructive/80">{aiDescriptionError}</p>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    <div className="d-lb-photo">
                                      <img
                                        src={lightboxUrl ?? record.fileUrls[currentLightboxIndex ?? 0]}
                                        alt={`Кадр ${(currentLightboxIndex ?? 0) + 1}`}
                                        onClick={(e) => e.stopPropagation()}
                                      />

                                      {/* Header: AI-бейдж + кнопки переоценки и AI-описания (поверх фото) */}
                                      <div className="d-lb-header">
                                        {(() => {
                                          const currentUrl = lightboxUrl ?? record.fileUrls[currentLightboxIndex ?? 0];
                                          const match = record.aiResults?.find((r) => normalizeUrl(r.url) === normalizeUrl(currentUrl));
                                          return match?.score != null ? (
                                            <span className="d-ai-badge">AI: {match.score}/10</span>
                                          ) : null;
                                        })()}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const currentUrl = lightboxUrl ?? record.fileUrls[currentLightboxIndex ?? 0];
                                            if (currentUrl) reindexSingleImage(currentUrl);
                                          }}
                                          disabled={curating}
                                          className="d-lb-btn d-lb-spark"
                                          aria-label="Переоценить кадр"
                                        >
                                          {curating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            fetchAiDescription();
                                          }}
                                          disabled={aiDescriptionLoading || !record || currentLightboxIndex === null}
                                          className="d-lb-btn d-lb-ai-desc"
                                          aria-label="Получить AI-описание"
                                        >
                                          {aiDescriptionLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <MessageSquareText className="h-4 w-4" />
                                          )}
                                        </button>
                                      </div>

                                      {/* Close button */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setLightboxUrl(null);
                                        }}
                                        className="d-lb-btn d-lb-close"
                                        aria-label="Закрыть"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>

                                      {/* Navigation buttons */}
                                      {record.fileUrls.length > 1 && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              lightboxPrev();
                                            }}
                                            className="d-lb-btn d-lb-prev"
                                            aria-label="Предыдущее фото"
                                          >
                                            <ChevronLeft className="h-5 w-5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              lightboxNext();
                                            }}
                                            className="d-lb-btn d-lb-next"
                                            aria-label="Следующее фото"
                                          >
                                            <ChevronRight className="h-5 w-5" />
                                          </button>
                                        </>
                                      )}

                                      {/* Нижняя панель внутри рамки фото: скачать слева, счётчик по центру, корзина справа */}
                                      <div className="d-lb-bar" onClick={(e) => e.stopPropagation()}>
                                        <button
                                          type="button"
                                          onClick={handleDownloadSingle}
                                          disabled={singleDownloading}
                                          className="d-lb-dl"
                                        >
                                          <Download className="h-4 w-4" />
                                          {singleDownloading ? "Скачиваем…" : "Скачать это фото"}
                                        </button>
                                        <span className="d-lb-count">
                                          {(currentLightboxIndex ?? 0) + 1} / {record.fileUrls.length}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={deleteCurrentImage}
                                          disabled={deleting || currentLightboxIndex === null}
                                          className="d-lb-trash"
                                          aria-label="Удалить из Cloudinary"
                                          title="Удалить фото"
                                        >
                                          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
}
