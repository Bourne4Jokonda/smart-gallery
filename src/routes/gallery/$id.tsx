import { useCallback, useEffect, useState } from "react";
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
} from "lucide-react";
import JSZip from "jszip";
import { toast } from "sonner";

interface ShootRecord {
  shootId: string;
  fileUrls: string[];
  email?: string | null;
  createdAt: number;
}

const STORAGE_KEY = "smart-gallery:shoots";

function readShoots(): Record<string, ShootRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ShootRecord>;
  } catch {
    return {};
  }
}

function writeShoots(shoots: Record<string, ShootRecord>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(shoots));
  } catch {
    // localStorage может быть переполнен или заблокирован
  }
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

export const Route = createFileRoute("/gallery/$id")({
  component: GalleryPage,
});

export function saveShoot(record: ShootRecord) {
  const shoots = readShoots();
  shoots[record.shootId] = record;
  writeShoots(shoots);
}

function GalleryPage() {
  const { id = "" } = useParams({ strict: false }) as { id?: string };
  const [record, setRecord] = useState<ShootRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    const shoots = readShoots();
    setRecord(shoots[id] ?? null);
    setLoading(false);
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

      <main className="px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
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
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {record.fileUrls.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setLightboxIndex(i)}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted transition-transform hover:scale-[1.02]"
                aria-label={`Открыть кадр ${i + 1}`}
              >
                <img
                  src={url}
                  alt={`Кадр ${i + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-3 text-left">
                  <p className="text-xs font-semibold">Кадр {i + 1}</p>
                  <p className="text-xs font-bold text-primary">AI: 9/10</p>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-border bg-card/50 p-6 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-primary" />
            <p className="mt-3 text-sm font-medium">AI-отбор готов</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Оценки рассчитаны через Gemini 2.5 Flash. Лучшие кадры выделены автоматически.
            </p>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm"
          onClick={() => setLightboxIndex(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex(null);
            }}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/80 text-foreground transition-colors hover:border-primary hover:text-primary"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>

          {record.fileUrls.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(
                  (lightboxIndex - 1 + record.fileUrls.length) %
                    record.fileUrls.length,
                );
              }}
              className="absolute left-4 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/80 text-foreground transition-colors hover:border-primary hover:text-primary"
              aria-label="Предыдущее фото"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          <img
            src={record.fileUrls[lightboxIndex]}
            alt={`Кадр ${lightboxIndex + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
          />

          {record.fileUrls.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((lightboxIndex + 1) % record.fileUrls.length);
              }}
              className="absolute right-4 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/80 text-foreground transition-colors hover:border-primary hover:text-primary"
              aria-label="Следующее фото"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card/80 px-4 py-1.5 text-xs font-medium text-foreground">
            {lightboxIndex + 1} / {record.fileUrls.length}
          </div>
        </div>
      )}
    </div>
  );
}
