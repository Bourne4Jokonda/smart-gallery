import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Camera, Images, Loader2 } from "lucide-react";
import { getAuthInstance } from "@/lib/firebase";

export const Route = createFileRoute("/public-gallery/$id")({
  component: PublicGalleryPage,
});

function PublicGalleryPage() {
  const { id = "" } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<{
    shootId: string;
    fileUrls: string[];
    email?: string | null;
    createdAt: number;
    aiResults?: Array<{ url: string; score: number | null; status: string; error?: string }>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const auth = getAuthInstance();
        const user = auth.currentUser;
        const res = await fetch(`/api/shoot?id=${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          shootId: string;
          fileUrls: string[];
          email?: string | null;
          createdAt: number;
          aiResults?: Array<{ url: string; score: number | null; status: string; error?: string }>;
        };
        if (!cancelled) {
          setRecord(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

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
            <Link to="/" className="inline-flex items-center gap-2 font-bold tracking-tight">
              <span className="inline-flex rounded-lg bg-primary p-1.5 text-primary-foreground">SG</span>
              Smart Gallery
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-5 py-20 text-center sm:px-8">
          <Images className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-5 text-2xl font-bold sm:text-3xl">Съёмка не найдена</h1>
          <p className="mt-3 text-sm text-muted-foreground">Ссылка неверная или съёмка была удалена.</p>
          <Link to="/" className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]">
            На главную
          </Link>
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
          <Link to="/" className="inline-flex items-center gap-2 font-bold tracking-tight">
            <span className="inline-flex rounded-lg bg-primary p-1.5 text-primary-foreground">SG</span>
            Smart Gallery
          </Link>
          <Link to="/login" className="rounded-lg bg-white px-3 py-2 text-black text-sm">Войти</Link>
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
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {record.fileUrls.map((url, i) => (
            <div key={url} className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
              <img src={url} alt={`Кадр ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-3 text-left">
                <p className="text-xs font-semibold">Кадр {i + 1}</p>
                <p className="text-xs font-bold text-muted-foreground">AI: —</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-border bg-card/50 p-6 text-center">
          <Camera className="mx-auto h-6 w-6 text-primary" />
          <p className="mt-3 text-sm font-medium">Хотите такой же AI-отбор?</p>
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
