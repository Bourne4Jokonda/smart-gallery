import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Camera, Images, KeyRound, Loader2, Lock } from "lucide-react";

type ShootRecord = {
  shootId: string;
  fileUrls: string[];
  email?: string | null;
  createdAt: number;
  aiResults?: Array<{ url: string; score: number | null; status: string; error?: string }>;
};

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
          throw new Error("bad");
        }
        const data = (await res.json()) as ShootRecord & { ok: boolean };
        if (cancelled) return;
        setRecord({
          shootId: data.shootId,
          fileUrls: data.fileUrls ?? [],
          email: data.email ?? null,
          createdAt: data.createdAt,
          aiResults: data.aiResults ?? [],
        });
        setPhase("unlocked");
      } catch {
        if (!cancelled) {
          setError("Не удалось загрузить галерею");
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
        };
        if (cancelled) return;
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
        fileUrls: data.fileUrls ?? [],
        email: data.email ?? null,
        createdAt: data.createdAt,
        aiResults: data.aiResults ?? [],
      });
      setPhase("unlocked");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неверный пароль");
    } finally {
      setChecking(false);
    }
  };

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
            <Link to="/" className="inline-flex items-center gap-2 font-bold tracking-tight">
              <span className="inline-flex rounded-lg bg-primary p-1.5 text-primary-foreground">SG</span>
              Smart Gallery
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-5 py-20 text-center sm:px-8">
          <Images className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-5 text-2xl font-bold sm:text-3xl">Съёмка не найдена</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {error ?? "Ссылка неверная, съёмка удалена или требуется пароль."}
          </p>
          <Link to="/" className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]">
            На главную
          </Link>
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

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <header className="border-b border-border px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="inline-flex items-center gap-2 font-bold tracking-tight">
            <span className="inline-flex rounded-lg bg-primary p-1.5 text-primary-foreground">SG</span>
            Smart Gallery
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3 text-primary" />
            защищено паролем
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-primary">Публичная галерея</p>
            <h1 className="mt-1 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">Съёмка #{record.shootId.slice(-6)}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {dateStr} · {record.email ? record.email : "без email"} · {record.fileUrls.length} фото
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            Фото хранятся в Cloudinary
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {record.fileUrls.map((url, i) => {
            const match = record.aiResults?.find((r) => r.url === url);
            return (
              <div key={url} className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
                <img src={url} alt={`Кадр ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-3 text-left">
                  <p className="text-xs font-semibold">Кадр {i + 1}</p>
                  <p className="text-xs font-bold text-muted-foreground">
                    {match?.score != null ? `AI: ${match.score}/10` : "AI: —"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 rounded-2xl border border-border bg-card/50 p-6 text-center">
          <Camera className="mx-auto h-6 w-6 text-primary" />
          <p className="mt-3 text-sm font-medium">Хотите такую же галерею?</p>
          <p className="mt-1 text-xs text-muted-foreground">Зарегистрируйтесь и загрузите свою съёмку.</p>
          <Link to="/login" className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]">
            Войти / Зарегистрироваться
          </Link>
        </div>
      </main>

      <footer className="border-t border-border px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-5xl text-center text-xs text-muted-foreground">
          © 2026 Умная галерея для фотографов
        </div>
      </footer>
    </div>
  );
}