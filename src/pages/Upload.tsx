import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FolderOpen,
  Images,
  Loader2,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import {
  MAX_FILES,
  MAX_FILE_SIZE,
  isCloudinaryConfigured,
  uploadShoot,
} from "@/lib/uploads";
import { saveShoot } from "@/routes/gallery/$id";

function generateShootId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `shoot-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface Item {
  file: File;
  preview: string;
  valid: boolean;
  reason: string;
  progress: number;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function validate(file: File): { valid: boolean; reason: string } {
  if (!file.type.startsWith("image/")) {
    return { valid: false, reason: "Не изображение" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, reason: "Больше 20 МБ" };
  }
  return { valid: true, reason: "" };
}

export default function UploadPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "done">("idle");
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [shootId, setShootId] = useState<string>("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResults, setAiResults] = useState<
    { url: string; score: number | null; status: string; error?: string }[]
  >([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored =
      localStorage.getItem("smart-gallery-email") ?? localStorage.getItem("email");
    if (stored) setEmail(stored);
  }, []);

  useEffect(
    () => () => {
      items.forEach((it) => URL.revokeObjectURL(it.preview));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const validItems = useMemo(() => items.filter((i) => i.valid), [items]);
  const totalProgress = useMemo(() => {
    if (validItems.length === 0) return 0;
    return Math.round(
      validItems.reduce((sum, i) => sum + i.progress, 0) / validItems.length,
    );
  }, [validItems]);

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const incoming = Array.from(list);
    setItems((prev) => {
      const room = MAX_FILES - prev.length;
      if (room <= 0) {
        toast.error(`Максимум ${MAX_FILES} файлов за раз`);
        return prev;
      }
      const slice = incoming.slice(0, room);
      if (slice.length < incoming.length) {
        toast.error(`Добавлены не все файлы — лимит ${MAX_FILES} за раз`);
      }
      const next = slice.map<Item>((file) => {
        const { valid, reason } = validate(file);
        return {
          file,
          preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
          valid,
          reason,
          progress: 0,
        };
      });
      const rejected = next.filter((i) => !i.valid).length;
      if (rejected > 0) {
        toast.error(`${rejected} файл(ов) не подходят`, {
          description: "Принимаем только изображения до 100 МБ.",
        });
      }
      return [...prev, ...next];
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const start = async () => {
    if (validItems.length === 0 || !consent) return;
    if (!isCloudinaryConfigured()) {
      toast.error("Хранилище недоступно", {
        description: "Попробуйте позже или напишите нам в Telegram.",
      });
      return;
    }
    setStatus("uploading");
    try {
      const files = validItems.map((i) => i.file);
      const result = await uploadShoot(files, {
        email,
        consent,
        onProgress: (index, percent) => {
          setItems((prev) => {
            const target = prev.filter((i) => i.valid)[index];
            if (!target) return prev;
            return prev.map((i) => (i === target ? { ...i, progress: percent } : i));
          });
        },
      });
      const newShootId = generateShootId();
      saveShoot({
        shootId: newShootId,
        fileUrls: result.fileUrls,
        email,
        createdAt: Date.now(),
      });
      setUploadedUrls(result.fileUrls);
      setShootId(newShootId);
      setAiResults([]);
      setStatus("done");
      toast.success(`Загружено ${result.fileUrls.length} фото`, {
        description: "AI приступил к отбору — скоро покажем результат.",
      });
      runAiCurate(newShootId, result.fileUrls);
    } catch (err) {
      setStatus("idle");
      const message =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      toast.error("Не удалось загрузить фото", {
        description: message,
      });
    }
  };

  const runAiCurate = async (shootIdToUse: string, fileUrls: string[]) => {
    try {
      setAiBusy(true);
      const response = await fetch("/api/curate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shootId: shootIdToUse, fileUrls }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        results?: typeof aiResults;
        error?: string;
      };
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "AI не ответил");
      }
      setAiResults(data.results ?? []);
      toast.success("AI-отбор готов");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      toast.error("AI-отбор не удался", { description: message });
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <header className="border-b border-border px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 font-bold tracking-tight">
            <span className="inline-flex rounded-lg bg-primary p-1.5">
              <Camera className="h-4 w-4 text-primary-foreground" />
            </span>
            Умная галерея
          </Link>
          <Link
            to="/"
            className="text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            На главную
          </Link>
        </div>
      </header>

      <main className="px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">
            Загрузите свою съёмку
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground">
            Перетащите папку с фото (до 2000 файлов, JPG/PNG/RAW до 100MB). AI отберёт
            лучшие за 10 минут. Мы сожмём фото автоматически.
          </p>

          {/* DROPZONE */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInput.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileInput.current?.click();
            }}
            className={`mt-8 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
              dragging
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:border-primary/60"
            }`}
          >
            <span className="inline-flex rounded-2xl bg-primary/15 p-4">
              <UploadCloud className="h-8 w-8 text-primary" />
            </span>
            <p className="mt-5 text-base font-semibold sm:text-lg">
              Перетащите файлы сюда или нажмите для выбора
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              JPG, PNG, RAW · до 100 МБ на файл (сжимаем автоматически)
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                folderInput.current?.click();
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary"
            >
              <FolderOpen className="h-4 w-4 text-primary" />
              Выбрать папку
            </button>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={folderInput}
            type="file"
            multiple
            className="hidden"
            // @ts-expect-error нестандартные атрибуты выбора папки
            webkitdirectory=""
            directory=""
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {/* COUNTER + PROGRESS */}
          {items.length > 0 && (
            <div className="mt-8 rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold">
                  Выбрано {items.length} / {MAX_FILES}
                  {items.length !== validItems.length && (
                    <span className="ml-2 text-destructive">
                      · подходят {validItems.length}
                    </span>
                  )}
                </p>
                {status !== "done" && (
                  <button
                    onClick={() => setItems([])}
                    className="text-sm text-muted-foreground hover:text-destructive"
                  >
                    Очистить список
                  </button>
                )}
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${totalProgress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Общий прогресс: {totalProgress}%
              </p>
            </div>
          )}

          {/* FILE LIST */}
          {items.length > 0 && (
            <ul className="mt-5 max-h-96 space-y-2 overflow-y-auto pr-1">
              {items.map((item, i) => (
                <li
                  key={`${item.file.name}-${i}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {item.preview ? (
                      <img
                        src={item.preview}
                        alt={item.file.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        <Images className="h-5 w-5 text-muted-foreground" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(item.file.size)}
                      {!item.valid && (
                        <span className="ml-2 text-destructive">{item.reason}</span>
                      )}
                    </p>
                    {item.valid && (
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {item.valid ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                  )}
                  {status === "idle" && (
                    <button
                      onClick={() => removeItem(i)}
                      aria-label={`Убрать ${item.file.name}`}
                      className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* CONSENT */}
          {validItems.length > 0 && status === "idle" && (
            <label className="mt-8 flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card p-4">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-border bg-background accent-primary text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <span className="text-sm leading-relaxed text-foreground">
                Я получил согласие клиентов на обработку фото и согласен на трансграничную передачу фото в{" "}
                <a
                  href="https://cloudinary.com/terms"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  Cloudinary
                </a>{" "}
                для отображения загруженных фото. Фото хранятся 7 дней и удаляются автоматически.
              </span>
            </label>
          )}

          {/* ACTION */}
          <button
            onClick={start}
            disabled={validItems.length === 0 || status !== "idle" || !consent}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-base font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === "uploading" ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Загружаем… {totalProgress}%
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Запустить AI-отбор
              </>
            )}
          </button>
          {status === "idle" && validItems.length > 0 && !consent && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Отметьте согласие чтобы продолжить
            </p>
          )}

          {/* RESULT */}
          {status === "done" && (
            <div className="mt-10 rounded-3xl border border-primary/40 bg-primary/10 p-6 sm:p-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-semibold">
                    Загружено {uploadedUrls.length} фото
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {email ? `Личный кабинет: ${email}` : "Без привязки к email"}
                    {" · "}
                    {new Date().toLocaleString("ru-RU", {
                      timeZone: "Europe/Moscow",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="rounded-xl border border-primary/30 bg-background/60 px-4 py-3 text-sm">
                  <p className="font-semibold text-primary">Ссылка на галерею</p>
                  <Link
                    to="/gallery/$id"
                    params={{ id: shootId }}
                    className="mt-1 block break-all text-muted-foreground transition-colors hover:text-primary"
                  >
                    {typeof window !== "undefined"
                      ? `${window.location.origin}/gallery/${shootId}`
                      : `/gallery/${shootId}`}
                  </Link>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                {uploadedUrls.slice(0, 9).map((url, i) => (
                  <div
                    key={url}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-primary/30 bg-muted"
                  >
                    <img
                      src={url}
                      alt={`Загруженный кадр ${i + 1}`}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/80 to-transparent p-2 text-left">
                      <p className="text-xs font-medium">Кадр {i + 1}</p>
                      {aiResults.length > 0 && (
                        (() => {
                          const match = aiResults.find((r: { url: string; score?: number }) => r.url === url);
                          return (
                            <p className="text-xs font-bold text-primary">
                              {match?.score != null ? `AI: ${match.score}/10` : aiBusy ? "Оцениваем…" : "—"}
                            </p>
                          );
                        })()
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Все файлы загружены в Cloudinary и будут доступны по прямой ссылке.
                </p>
                <button
                  onClick={() => {
                    setStatus("idle");
                    setUploadedUrls([]);
                    setItems([]);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary"
                >
                  Загрузить другую съёмку
                </button>
              </div>
            </div>
          )}
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
            Остались вопросы?{" "}
            <a
              href="https://t.me/ai_gallery_helper"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              Напишите в Telegram: @ai_gallery_helper
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
