import { useEffect, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { Camera, Download, Images, Loader2, Sparkles } from "lucide-react";

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

export function saveShoot(record: ShootRecord) {
  const shoots = readShoots();
  shoots[record.shootId] = record;
  writeShoots(shoots);
}

export default function GalleryPage() {
  const { id = "" } = useParams({ strict: false }) as { id?: string };
  const [record, setRecord] = useState<ShootRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const shoots = readShoots();
    setRecord(shoots[id] ?? null);
    setLoading(false);
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
                {record.fileUrls.length === 1
                  ? "фото"
                  : record.fileUrls.length < 5
                    ? "фото"
                    : "фото"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {dateStr}
                {record.email ? ` · ${record.email}` : " · без email"}
              </p>
            </div>
            <a
              href={record.fileUrls[0] ?? "#"}
              download
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary"
            >
              <Download className="h-4 w-4 text-primary" />
              Скачать всё
            </a>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {record.fileUrls.map((url, i) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted transition-transform hover:scale-[1.02]"
              >
                <img
                  src={url}
                  alt={`Кадр ${i + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-3 text-left">
                  <p className="text-xs font-semibold">Кадр {i + 1}</p>
                </div>
              </a>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-primary" />
            <p className="mt-3 text-sm font-medium">
              AI-отбор скоро будет доступен
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Сейчас мы сохраняем все фото. В следующей версии AI отберёт
              лучшие кадры автоматически.
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
    </div>
  );
}
