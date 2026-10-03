import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Camera,
  ChevronRight,
  Copy,
  ExternalLink,
  Images,
  Loader2,
  RefreshCcw,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { readShoots, removeShoot, saveShoot } from "@/lib/storage";
import { getAuthInstance, getUserShoots, signOutUser, updateShootRecord, deleteShootRecord } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";

export const Route = createFileRoute("/profile")({
  beforeLoad: () => {},
  errorComponent: ProfileError,
  component: ProfilePage,
});

type ShootItem = {
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
  public?: boolean;
};

function ProfileError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <div className="mx-auto max-w-2xl px-5 py-20 text-center sm:px-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Кабинет не загрузился</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {error?.message || "Неизвестная ошибка"}
        </p>
        <button onClick={reset} className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
          Обновить
        </button>
      </div>
    </div>
  );
}

function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [shoots, setShoots] = useState<ShootItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuthInstance();
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, (u) => {
      if (cancelled) return;
      setUser(u);
      setAuthChecked(true);
      if (!u) {
        setLoading(false);
        setShoots([]);
        window.location.href = "/login";
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setProfileError(null);
      try {
        const cloudShoots = await getUserShoots(user.uid);
        if (cancelled) return;
        const local = readShoots();
        const merged: Record<string, ShootItem> = { ...local };
        for (const s of cloudShoots) merged[s.shootId] = s;
        for (const s of cloudShoots) saveShoot(s);
        const list = Object.values(merged).sort((a, b) => b.createdAt - a.createdAt);
        if (!cancelled) {
          setShoots(list);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("[profile] failed to load from cloud:", err);
          const message = err instanceof Error ? err.message : "Неизвестная ошибка";
          setProfileError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const bestCount = useMemo(
    () =>
      shoots.reduce((sum, s) => {
        const count = s.aiResults?.filter((r) => r.status === "ok" && r.score != null && r.score >= 7).length ?? 0;
        return sum + count;
      }, 0),
    [shoots],
  );

  const handleDelete = async (shootId: string, email?: string | null) => {
    const confirmed = confirm(
      `Удалить съёмку "${shootId}"?\n\nЭто необратимо: запись исчезнет из кабинета и локального кэша.`,
    );
    if (!confirmed) return;

    const finalConfirm = confirm(
      `Последнее подтверждение: удалить "${shootId}" из кабинета?`,
    );
    if (!finalConfirm) return;

    setRemoving(shootId);
    const toastId = toast.loading("Удаляем…");
    try {
      setShoots((prev) => prev.filter((s) => s.shootId !== shootId));
      removeShoot(shootId);
      try {
        await deleteShootRecord(shootId);
      } catch {
        // ignore
      }
      toast.success("Съёмка удалена из кабинета", { id: toastId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка удаления";
      toast.error(message, { id: toastId });
    } finally {
      setRemoving(null);
    }
  };

  const handleRefresh = async () => {
    if (!user || refreshing) return;
    setRefreshing(true);
    try {
      const cloudShoots = await getUserShoots(user.uid);
      const merged: Record<string, ShootItem> = { ...readShoots() };
      for (const s of cloudShoots) merged[s.shootId] = s;
      for (const s of cloudShoots) saveShoot(s);
      const list = Object.values(merged).sort((a, b) => b.createdAt - a.createdAt);
      setShoots(list);
      toast.success("Синхронизировано с облаком");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось обновить съёмки";
      toast.error(message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
      toast.success("Вы вышли");
      window.location.href = "/login";
    } catch {
      toast.error("Не удалось выйти");
    }
  };

  const handleCopyLink = async (shootId: string) => {
    const url = `${window.location.origin}/gallery/${shootId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Ссылка скопирована");
    } catch {
      toast.error("Не удалось скопировать ссылку");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <main className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-primary">Личный кабинет</p>
            <h1 className="mt-1 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">Мои съёмки</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {user?.email ? `Аккаунт: ${user.email}` : "Загрузка аккаунта…"}
              <span className="ml-2">
                Всего съёмок: {shoots.length} · Лучших кадров по AI: {bestCount}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/upload"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <UploadCloud className="h-4 w-4" />
              Загрузить новую съёмку
            </Link>
          </div>
        </div>

        {shoots.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-border bg-card p-10 text-center">
            <Images className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-5 text-2xl font-bold">Съёмок пока нет</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Загрузите первую съёмку, и здесь появится карточка с результатами.
            </p>
            <Link
              to="/upload"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <Sparkles className="h-4 w-4" />
              Загрузить съёмку
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shoots.map((s) => {
              const bests = s.aiResults?.filter((r) => r.status === "ok" && r.score != null && r.score >= 7).length ?? 0;
              const date = new Date(s.createdAt);
              const dateStr = date.toLocaleString("ru-RU", {
                timeZone: "Europe/Moscow",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              const cover = s.fileUrls[0] ?? "";
              return (
                <div key={s.shootId} className="rounded-2xl border border-border bg-card p-4">
                  <div className="aspect-video overflow-hidden rounded-xl bg-muted">
                    {cover ? (
                      <img src={cover} alt={s.shootId} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Нет превью</div>
                    )}
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="text-sm font-semibold">Съёмка #{s.shootId.slice(-6)}</p>
                    <p className="text-xs text-muted-foreground">{dateStr}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.fileUrls.length} фото · лучших: {bests}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      to={`/gallery/${s.shootId}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:border-primary"
                    >
                      Открыть <ChevronRight className="h-3 w-3" />
                    </Link>
                    {s.public && (
                      <button
                        type="button"
                        onClick={() => handleCopyLink(`${window.location.origin}/public-gallery/${s.shootId}`)}
                        className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-colors hover:border-primary"
                      >
                        <ExternalLink className="h-3 w-3" /> Публичная ссылка
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopyLink(`${window.location.origin}/gallery/${s.shootId}`)}
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:border-primary"
                    >
                      <Copy className="h-3 w-3" /> Ссылка
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.shootId, s.email)}
                      disabled={removing === s.shootId}
                      className="inline-flex items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label="Удалить съёмку"
                    >
                      {removing === s.shootId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="border-t border-border px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-5xl text-center text-xs text-muted-foreground">
          © 2026 Умная галерея для фотографов
        </div>
      </footer>
    </div>
  );
}
