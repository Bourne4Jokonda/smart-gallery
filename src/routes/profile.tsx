import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Camera,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Images,
  KeyRound,
  Loader2,
  Pencil,
  RefreshCcw,
  Share2,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
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
  title?: string;
  password?: string;
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
  const [passwordShootId, setPasswordShootId] = useState<string | null>(null);
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [hasPassword, setHasPassword] = useState<Record<string, boolean>>({});
  const [togglingPublic, setTogglingPublic] = useState<string | null>(null);
  const [renameShootId, setRenameShootId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);

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

      try {
        const res = await fetch("/api/delete-shoot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email ?? null, shootId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
          const reason = typeof data?.error === "string" ? data.error : "Не удалось очистить Cloudinary";
          toast.error(reason, { id: toastId });
        }
      } catch {
        // ignore cloud cleanup error
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

  const openPasswordDialog = (shootId: string, current: boolean) => {
    setPasswordShootId(shootId);
    setHasPassword((prev) => ({ ...prev, [shootId]: current }));
    setPasswordValue("");
  };

  const savePassword = async () => {
    if (!passwordShootId) return;
    const pw = passwordValue.trim();
    setPasswordBusy(true);
    try {
      // Прямая клиентская запись: клиент авторизован и владеет сессией,
      // Firestore rules пропускают update (userId == request.auth.uid).
      await updateShootRecord(passwordShootId, { password: pw });
      setHasPassword((prev) => ({ ...prev, [passwordShootId]: pw.length > 0 }));
      toast.success(pw.length > 0 ? "Пароль установлен" : "Пароль снят, галерея открыта");
      setPasswordShootId(null);
      setPasswordValue("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка пароля";
      toast.error(message);
    } finally {
      setPasswordBusy(false);
    }
  };

  const togglePublic = async (shootId: string, current: boolean) => {
    setTogglingPublic(shootId);
    try {
      await updateShootRecord(shootId, { public: !current });
      setShoots((prev) =>
        prev.map((s) => (s.shootId === shootId ? { ...s, public: !current } : s)),
      );
      toast.success(!current ? "Съёмка открыта для клиента" : "Съёмка закрыта, доступ прекращён");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка переключения";
      toast.error(message);
    } finally {
      setTogglingPublic(null);
    }
  };

  const openRename = (shootId: string, currentTitle?: string) => {
    setRenameShootId(shootId);
    setRenameValue(currentTitle ?? "");
  };

  const saveRename = async () => {
    if (!renameShootId) return;
    const title = renameValue.trim();
    if (!title) {
      toast.error("Введите название");
      return;
    }
    setRenameBusy(true);
    try {
      await updateShootRecord(renameShootId, { title });
      setShoots((prev) =>
        prev.map((s) => (s.shootId === renameShootId ? { ...s, title } : s)),
      );
      toast.success("Название сохранено");
      setRenameShootId(null);
      setRenameValue("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка сохранения";
      toast.error(message);
    } finally {
      setRenameBusy(false);
    }
  };

  const handleCopyLink = async (url: string) => {
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
              const title = s.title?.trim() || "";
              return (
                <div key={s.shootId} className="rounded-2xl border border-border bg-card p-4">
                  <div className="relative">
                    <Link
                      to={`/gallery/${s.shootId}`}
                      className="block overflow-hidden rounded-xl bg-muted transition-transform hover:scale-[1.01]"
                      title="Открыть съёмку"
                    >
                      <div className="aspect-video">
                        {cover ? (
                          <img src={cover} alt={title || s.shootId} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Нет превью</div>
                        )}
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.shootId, s.email)}
                      disabled={removing === s.shootId}
                      className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/40 bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-destructive disabled:opacity-60"
                      aria-label="Удалить съёмку"
                      title="Удалить съёмку"
                    >
                      {removing === s.shootId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center gap-1">
                      <Link to={`/gallery/${s.shootId}`} className="text-sm font-semibold hover:text-primary">
                        {title || `Съёмка #${s.shootId.slice(-6)}`}
                      </Link>
                      <button
                        type="button"
                        onClick={() => openRename(s.shootId, title)}
                        className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                        aria-label="Переименовать"
                        title="Переименовать"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">{dateStr} · #{s.shootId.slice(-6)}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.fileUrls.length} фото · лучших: {bests}
                    </p>
                  </div>
                  <div className="mt-3 space-y-2">
                    <button
                      type="button"
                      onClick={() => togglePublic(s.shootId, Boolean(s.public))}
                      disabled={togglingPublic === s.shootId}
                      className={`inline-flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                        s.public
                          ? "border-primary/40 bg-primary/10 text-primary hover:border-primary"
                          : "border-border text-foreground hover:border-primary"
                      }`}
                      title={s.public ? "Доступ включён — нажмите, чтобы закрыть" : "Доступ выключен — нажмите, чтобы открыть клиенту"}
                    >
                      <span>Открыть доступ</span>
                      <span
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          s.public ? "bg-primary" : "bg-border"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            s.public ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </span>
                    </button>
                    <div className={`flex gap-2 ${s.public ? "" : "pointer-events-none opacity-35"}`}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openPasswordDialog(s.shootId, Boolean(hasPassword[s.shootId]))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") openPasswordDialog(s.shootId, Boolean(hasPassword[s.shootId]));
                        }}
                        className="inline-flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary"
                        title={hasPassword[s.shootId] ? "Сменить/снять пароль" : "Задать пароль"}
                      >
                        <KeyRound className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {hasPassword[s.shootId] ? "Пароль задан ••••••" : "Пароль не задан"}
                        </span>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const pw = s.password ?? "";
                            if (!pw) {
                              toast.error("Пароль не задан — сначала установите его");
                              return;
                            }
                            try {
                              await navigator.clipboard.writeText(pw);
                              toast.success("Пароль скопирован");
                            } catch {
                              toast.error("Не удалось скопировать пароль");
                            }
                          }}
                          disabled={!hasPassword[s.shootId]}
                          className={`ml-auto inline-flex shrink-0 items-center justify-center rounded-md p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                            hasPassword[s.shootId]
                              ? "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                              : "text-muted-foreground"
                          }`}
                          title={hasPassword[s.shootId] ? "Скопировать пароль" : "Пароль не задан"}
                          aria-label="Скопировать пароль"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(`${window.location.origin}/public-gallery/${s.shootId}`)}
                        disabled={!s.public}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                          s.public
                            ? "border-primary/40 bg-primary/10 text-primary hover:border-primary"
                            : "border-border text-muted-foreground"
                        }`}
                        title="Скопировать ссылку для клиента"
                      >
                        <Share2 className="h-3 w-3" />
                        Ссылка
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      {passwordShootId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-5 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-base font-bold">
              Пароль съёмки <span className="text-primary">#{passwordShootId.slice(-6)}</span>
            </h3>
            <div className="relative mt-4">
              <input
                type={passwordVisible ? "text" : "password"}
                value={passwordValue}
                onChange={(e) => setPasswordValue(e.target.value)}
                placeholder="Введите пароль"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 pr-12 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setPasswordVisible((v) => !v)}
                className="absolute right-12 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={passwordVisible ? "Скрыть пароль" : "Показать пароль"}
              >
                {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const pw = passwordValue.trim();
                  if (!pw) return;
                  try {
                    await navigator.clipboard.writeText(pw);
                    toast.success("Пароль скопирован");
                  } catch {
                    toast.error("Не удалось скопировать пароль");
                  }
                }}
                disabled={!passwordValue.trim()}
                className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  passwordValue.trim() ? "text-muted-foreground hover:text-primary" : "text-muted-foreground"
                }`}
                aria-label="Скопировать пароль"
                title={passwordValue.trim() ? "Скопировать пароль" : "Пароль не введён"}
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-4 list-inside list-disc space-y-1 text-xs text-muted-foreground">
              <li>Клиент откроет галерею <span className="text-foreground">только после ввода пароля</span>.</li>
              <li>Минимум <span className="text-foreground">4 символа</span>.</li>
              <li>Оставьте <span className="text-foreground">пустым</span>, чтобы снять пароль — галерея откроется по ссылке без пароля.</li>
              <li>Не используйте легко угадываемые пароли (даты, имена).</li>
            </ul>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={savePassword}
                disabled={passwordBusy}
                className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
              >
                {passwordBusy ? "Сохраняем…" : "Подтвердить"}
              </button>
              <button
                type="button"
                onClick={() => setPasswordShootId(null)}
                className="rounded-xl border border-border px-4 py-3 text-sm font-medium transition-colors hover:border-primary"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {renameShootId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-5 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-base font-bold">Название съёмки</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Название видно только вам в кабинете. Ссылка и ID съёмки{" "}
              <span className="text-foreground">не меняются</span> — клиенту ничего не сломается.
            </p>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Например: Свадьба Иван и Мария"
              maxLength={60}
              className="mt-4 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary"
              autoFocus
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={saveRename}
                disabled={renameBusy}
                className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
              >
                {renameBusy ? "Сохраняем…" : "Сохранить название"}
              </button>
              <button
                type="button"
                onClick={() => setRenameShootId(null)}
                className="rounded-xl border border-border px-4 py-3 text-sm font-medium transition-colors hover:border-primary"
              >
                Отмена
              </button>
            </div>
          </div>
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
