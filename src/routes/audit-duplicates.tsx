import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getAuthInstance, getUserShoots } from "@/lib/firebase";

export const Route = createFileRoute("/audit-duplicates")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getAuthInstance().currentUser) {
      throw new Error("UNAUTH");
    }
  },
  component: AuditPage,
});

type ShootItem = {
  shootId: string;
  title?: string;
  fileUrls: string[];
  email?: string | null;
  createdAt: number;
  public?: boolean;
};

function AuditPage() {
  const [loading, setLoading] = useState(true);
  const [all, setAll] = useState<ShootItem[]>([]);
  const [duplicates, setDuplicates] = useState<Array<{ key: string; items: ShootItem[] }>>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const shoots = await getUserShoots();
        if (cancelled) return;
        const sorted = shoots.sort((a, b) => a.createdAt - b.createdAt);
        setAll(sorted);

        const map = new Map<string, ShootItem[]>();
        for (const s of sorted) {
          const key = JSON.stringify(s.fileUrls ?? []);
          const list = map.get(key) ?? [];
          list.push(s);
          map.set(key, list);
        }
        const dups = Array.from(map.entries())
          .filter(([, items]) => items.length > 1)
          .map(([key, items]) => ({ key, items }))
          .sort((a, b) => b.items.length - a.items.length);
        setDuplicates(dups);
      } catch (e) {
        console.error("audit failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        Загружаем кадр для аудита…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-5 py-10 text-foreground antialiased sm:px-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Аудит дублей</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Всего съёмок: {all.length} · Групп с дублирующимся контентом: {duplicates.length}
        </p>

        {duplicates.length === 0 && (
          <p className="mt-6 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Дублей не найдено.
          </p>
        )}

        <div className="mt-6 space-y-4">
          {duplicates.map(({ key, items }) => (
            <div key={key} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">
                Совпадение по fileUrls · {items.length} записи
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((s) => (
                  <div key={s.shootId} className="rounded-xl border border-border bg-background p-3">
                    <p className="text-sm font-semibold">{s.title?.trim() || `Съёмка #${s.shootId.slice(-6)}`}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString("ru-RU")} · #{s.shootId.slice(-6)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{s.fileUrls.length} фото · public: {String(Boolean(s.public))}</p>
                    <p className="mt-1 text-xs text-muted-foreground break-all">{s.email ?? "без email"}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Что смотреть:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Группы с одинаковым fileUrls — почти наверняка дубли загрузки.</li>
            <li>Если у дублей разный `createdAt` — скорее всего, повторная загрузка той же папки.</li>
            <li>Обрати внимание на непубличные съёмки с 100% AI-ошибок: это может быть следствием повторов загрузки или неудачных прогонов.</li>
            <li>Ничего не удаляется автоматически — это только просмотр.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
