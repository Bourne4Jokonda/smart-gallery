import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Copy,
  KeyRound,
  Loader2,
  Lock,
  ChevronLeft,
  ChevronRight,
  Download,
  Images,
  X,
} from "lucide-react";
import JSZip from "jszip";
import { toast } from "sonner";
import { getPublicUserProfile, type UserProfile } from "@/lib/firebase";

type ShootRecord = {
  shootId: string;
  title?: string;
  fileUrls: string[];
  email?: string | null;
  createdAt: number;
  hasPassword: boolean;
  userId?: string | null;
};

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

function WatermarkOverlay({ profile }: { profile: UserProfile }) {
  if (!profile?.watermarkEnabled || profile.watermarkType === "none") return null;
  const opacity = typeof profile.watermarkOpacity === "number" ? profile.watermarkOpacity : 0.35;
  const positionClass =
    profile.watermarkPosition === "center"
      ? "inset-0 flex items-center justify-center"
      : profile.watermarkPosition === "top-left"
        ? "inset-0 flex items-start justify-start p-4"
        : "inset-0 flex items-end justify-end p-4 pb-8";
  const content =
    profile.watermarkType === "image" && profile.watermarkImageUrl ? (
      <img src={profile.watermarkImageUrl} alt="" className="max-h-16 max-w-[70%] object-contain" />
    ) : (
      <span className="text-xs font-semibold tracking-wide text-white drop-shadow-md">
        {profile.watermarkText?.trim() || "Smart Gallery"}
      </span>
    );

  return (
    <div className={`pointer-events-none absolute ${positionClass}`}>
      <div className="rounded-xl bg-black/0 p-2" style={{ opacity }}>
        {content}
      </div>
    </div>
  );
}

async function downloadAsZip(
  urls: string[],
  shootId: string,
  onProgress?: (done: number, total: number) => void,
) {
  const zip = new JSZip();
  const folder = zip.folder(`gallery-${shootId.slice(-6)}`) ?? zip;
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
  const archive = await folder.generateAsync({ type: "blob", compression: "STORE" }, () => {});
  const archiveUrl = URL.createObjectURL(archive);
  const a = document.createElement("a");
  a.href = archiveUrl;
  a.download = `gallery-${shootId.slice(-6)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(archiveUrl), 1000);
}

async function downloadSinglePhoto(url: string, index: number) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const blob = await resp.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = filenameFromUrl(url, index);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

export const Route = createFileRoute("/public-gallery/$id")({
  component: PublicGalleryPage,
});

function PublicGalleryPage() {
  const { id = "" } = Route.useParams();
  const [phase, setPhase] = useState<"loading" | "gate" | "unlocked" | "notfound">("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [record, setRecord] = useState<ShootRecord | null>(null);

  // Lightbox state
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

  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      if (!record?.userId) {
        console.warn("[public-gallery] missing userId in record", record);
        return;
      }
      try {
        const data = await getPublicUserProfile(record.userId!);
        console.log("[public-gallery] public profile loaded", data);
        if (!cancelled) setProfile(data);
      } catch (err) {
        console.warn("[public-gallery] public profile load failed", err);
      }
      if (!cancelled && !profile && record?.userId) {
        try {
          const local = JSON.parse(localStorage.getItem(`smart-gallery-fallback-profile:${record.userId}`) || "null");
          if (local && local.watermarkEnabled) {
            setProfile(local);
          }
        } catch {
          // ignore
        }
      }
    };
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [record?.userId]);

  // ZIP / single download
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState({ done: 0, total: 0 });
  const [singleDownloading, setSingleDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const unlock = async (pw: string) => {
      try {
        const res = await fetch("/api/public-shoot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, password: pw }),
        });
        if (!res.ok) {
          if (res.status === 404) {
            if (!cancelled) setPhase("notfound");
            return;
          }
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Не удалось загрузить галерею");
        }
        const data = (await res.json()) as ShootRecord & { ok: boolean };
        if (cancelled) return;
        setRecord({
          shootId: data.shootId,
          title: data.title,
          fileUrls: data.fileUrls ?? [],
          email: data.email ?? null,
          createdAt: data.createdAt,
          hasPassword: Boolean(data.hasPassword),
          userId: data.userId ?? null,
        });
        setPhase("unlocked");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Не удалось загрузить галерею");
          setPhase("notfound");
        }
      }
    };

    const load = async () => {
      setPhase("loading");
      setError(null);
      setRecord(null);
      try {
        const res = await fetch(`/api/public-shoot?id=${encodeURIComponent(id)}`);
        if (!res.ok) {
          if (res.status === 404) {
            if (!cancelled) setPhase("notfound");
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          ok: boolean;
          shootId: string;
          hasPassword: boolean;
          title?: string;
          userId?: string | null;
        };
        if (cancelled) return;
        setRecord({
          shootId: data.shootId,
          title: data.title,
          fileUrls: [],
          email: null,
          createdAt: Date.now(),
          hasPassword: Boolean(data.hasPassword),
          userId: data.userId ?? null,
        });
        if (data.hasPassword) {
          setPhase("gate");
        } else {
          await unlock("");
        }
      } catch {
        if (!cancelled) {
          setError("Не удалось загрузить галерею");
          setPhase("notfound");
        }
      }
    };

    load();
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
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") lightboxNext();
      if (e.key === "ArrowLeft") lightboxPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [currentLightboxIndex, lightboxNext, lightboxPrev, closeLightbox]);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/public-shoot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password: password.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 404) {
          setPhase("notfound");
          return;
        }
        throw new Error(data?.error || "Неверный пароль");
      }
      setRecord({
        shootId: data.shootId,
        title: data.title,
        fileUrls: data.fileUrls ?? [],
        email: data.email ?? null,
        createdAt: data.createdAt,
        hasPassword: Boolean(data.hasPassword),
      });
      setPhase("unlocked");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неверный пароль");
    } finally {
      setChecking(false);
    }
  };

  const handleDownloadZip = useCallback(async () => {
    if (!record || zipping) return;
    setZipping(true);
    setZipProgress({ done: 0, total: record.fileUrls.length });
    const toastId = toast.loading("Собираем ZIP…");
    try {
      await downloadAsZip(record.fileUrls, record.shootId, (done, total) =>
        setZipProgress({ done, total }),
      );
      toast.success(`ZIP готов — ${record.fileUrls.length} фото`, { id: toastId });
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
  }, [record, currentLightboxIndex, singleDownloading]);

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (phase === "notfound") {
    return (
      <div className="min-h-screen bg-background text-foreground antialiased">
        <header className="border-b border-border px-5 py-4 sm:px-8">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <span className="inline-flex items-center gap-2 font-bold tracking-tight">
              <span className="inline-flex rounded-lg bg-primary p-1.5 text-primary-foreground">SG</span>
              Smart Gallery
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-5 py-20 text-center sm:px-8">
          <Images className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-5 text-2xl font-bold sm:text-3xl">Съёмка не найдена</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {error ?? "Ссылка неверная, съёмка удалена или требуется пароль."}
          </p>
        </main>
      </div>
    );
  }

  if (phase === "gate") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5 text-foreground antialiased">
        <form
          onSubmit={submitPassword}
          className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 text-center shadow-sm"
        >
          <span className="mx-auto inline-flex rounded-2xl bg-primary/15 p-4">
            <Lock className="h-8 w-8 text-primary" />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Галерея защищена паролем</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Съёмка #{id.slice(-6)} · введите пароль, чтобы просмотреть фото
          </p>
          {error && (
            <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3">
            <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль галереи"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={checking || password.trim().length === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Открыть галерею
          </button>
          <p className="mt-4 text-xs text-muted-foreground/70">
            Фото доступны только после ввода правильного пароля
          </p>
        </form>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
  const displayName = record.title?.trim() || `Съёмка #${record.shootId.slice(-6)}`;

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* Единая шапка: логотип слева, «защищено паролем» справа */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="inline-flex items-center gap-2 font-bold tracking-tight">
            <span className="inline-flex rounded-lg bg-primary p-1.5 text-primary-foreground">SG</span>
            Smart Gallery
          </span>
          {record.hasPassword && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
              <Lock className="h-3 w-3 text-primary" />
              защищено паролем
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-primary">
              Публичная галерея
            </p>
            <h1 className="mt-1 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
              {displayName}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {dateStr} · {record.fileUrls.length} фото
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={zipping || record.fileUrls.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {zipping ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {zipProgress.total > 0
                  ? `Скачиваем ${zipProgress.done} / ${zipProgress.total}`
                  : "Собираем…"}
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Скачать всё (ZIP)
              </>
            )}
          </button>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {record.fileUrls.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => openLightbox(url)}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted transition-transform hover:scale-[1.02]"
              aria-label={`Открыть кадр ${i + 1}`}
            >
              <img
                src={url}
                alt={`Кадр ${i + 1}`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <WatermarkOverlay profile={profile} />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-3 text-left">
                <p className="text-xs font-semibold">Кадр {i + 1}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-border bg-card/50 p-6 text-center">
          <p className="text-sm font-medium">Нужна такая же галерея?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Все фото можно скачать одним архивом или по одному — нажмите на кадр.
          </p>
        </div>
      </main>

      <footer className="border-t border-border px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-5xl text-center text-xs text-muted-foreground">
          © 2026 Умная галерея для фотографов
        </div>
      </footer>

      {/* Лайтбокс */}
      {lightboxUrl !== null && record.fileUrls[currentLightboxIndex ?? 0] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative inline-block max-h-[85vh] max-w-[90vw]">
            <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeLightbox();
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
                    lightboxPrev();
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
                    lightboxNext();
                  }}
                  className="absolute -right-10 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/80 text-foreground transition-colors hover:border-primary hover:text-primary"
                  aria-label="Следующее фото"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            <img
              src={lightboxUrl ?? record.fileUrls[currentLightboxIndex ?? 0]}
              alt={`Кадр ${(currentLightboxIndex ?? 0) + 1}`}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            />
            <WatermarkOverlay profile={profile} />

            <div className="absolute -bottom-8 left-1/2 flex -translate-x-1/2 items-center whitespace-nowrap justify-center gap-2 rounded-full border border-border bg-card/80 px-4 py-1.5">
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
                {(currentLightboxIndex ?? 0) + 1} / {record.fileUrls.length}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
