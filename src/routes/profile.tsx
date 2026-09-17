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
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { readShoots, removeShoot, saveShoot } from "@/lib/storage";

export const Route = createFileRoute("/profile")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !localStorage.getItem("smart-gallery-user")) {
      throw redirect({ to: "/login" });
    }
  },
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
};

function ProfilePage() {
  const [shoots, setShoots] = useState<ShootItem[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    const all = readShoots();
    const list = Object.values(all).sort((a, b) => b.createdAt - a.createdAt);
    setShoots(list);
  }, []);

  const bestCount = useMemo(
    () =>
      shoots.reduce((sum, s) => {
        const count = s.aiResults?.filter((r) => r.status === "ok" && r.score != null && r.score >= 7).length ?? 0;
        return sum + count;
      }, 0),
    [shoots],
  );

  const handleDelete = async (shootId: string) => {
    setRemoving(shootId);
    try {
      removeShoot(shootId);
      setShoots((prev) => prev.filter((s) => s.shootId !== shootId));
      toast.success("Съёмка удалена из кабинета");
    } catch {
      toast.error("Не удалось удалить съёмку");
    } finally {
      setRemoving(null);
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
      <header className="border-b border-border px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 font-bold tracking-tight">
            <span className="inline-flex rounded-lg bg-primary p-1.5 text-primary-foreground">SG</span>
            Smart Gallery
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link to="/upload" className="rounded-lg bg-white px-3 py-2 text-black">Загрузить</Link>
            <Link to="/profile" className="rounded-lg border border-border px-3 py-2">Кабинет</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-primary">Личный кабинет</p>
            <h1 className="mt-1 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">Мои съёмки</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Всего съёмок: {shoots.length} · Лучших кадров по AI: {bestCount}
            </p>
          </div>
          <Link
            to="/upload"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
          >
            <UploadCloud className="h-4 w-4" />
            Загрузить новую съёмку
          </Link>
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
                    <button
                      type="button"
                      onClick={() => handleCopyLink(s.shootId)}
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:border-primary"
                    >
                      <Copy className="h-3 w-3" /> Ссылка
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.shootId)}
                      disabled={removing === s.shootId}
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-destructive transition-colors hover:border-destructive disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {removing === s.shootId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Удалить
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
