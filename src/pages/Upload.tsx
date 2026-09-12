import { useEffect, useMemo, useRef, useState } from "react";
import { Link, redirect, useNavigate } from "@tanstack/react-router";
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

function formatSize(bytes: number): string {
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

export const Route = createFileRoute("/upload")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !window.__SMART_GALLERY_USER__) {
      throw redirect({ to: "/login" });
    }
  },
  component: UploadPage,
});

function UploadPage() {
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
          description: "Принимаем только изображения до 20 МБ.",
        });
      }
      return [...prev, ...next];
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (!consent) {
      toast.error("Предварительно включите согласие на загрузку");
      return;
    }
    addFiles(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (!consent) {
      toast.error("Включите согласие на обработку и загрузку");
      return;
    }
    const toUpload = validItems;
    if (toUpload.length === 0) {
      toast.error("Нет валидных файлов для загрузки");
      return;
    }
    const id = generateShootId();
    setStatus("uploading");
    const urls: string[] = [];
    for (let i = 0; i < toUpload.length; i++) {
      setItems((prev) => {
        const next = [...prev];
        const target = next.find((it) => it.file === toUpload[i].file);
        if (target) target.progress = 10;
        return next;
      });
      const result = await uploadShoot(id, toUpload[i].file, (p) => {
        setItems((prev) => {
          const next = [...prev];
          const target = next.find((it) => it.file === toUpload[i].file);
          if (target) target.progress = p;
          return next;
        });
      });
      if (result?.secure_url) {
        urls.push(result.secure_url);
      }
      setItems((prev) => {
        const next = [...prev];
        const target = next.find((it) => it.file === toUpload[i].file);
        if (target) target.progress = 100;
        return next;
      });
    }
    setUploadedUrls(urls);
    setShootId(id);
    if (email) localStorage.setItem("smart-gallery-email", email);
    setStatus("done");
    toast.success("Загрузка завершена");
  };

  const copyLink = () => {
    const link = `${window.location.origin}/gallery/${shootId}`;
    navigator.clipboard.writeText(link).then(() => toast.success("Ссылка скопирована"));
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Загрузка фотосессии</h1>
          <p className="text-sm opacity-80">
            Перетащите изображения или выберите файлы/папку.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-black/80 px-4 py-2 text-white"
          >
            <Images className="h-4 w-4" /> Файлы
          </button>
          <button
            type="button"
            onClick={() => folderInput.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-black/80 px-4 py-2 text-white"
          >
            <FolderOpen className="h-4 w-4" /> Папка
          </button>
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded-2xl border-2 border-dashed p-6 transition ${
          dragging ? "border-white/60 bg-white/10" : "border-white/20"
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <UploadCloud className="h-10 w-10 opacity-80" />
          <p className="text-sm opacity-80">
            Перетащите сюда до {MAX_FILES} изображений
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <input
            ref={folderInput}
            type="file"
            accept="image/*"
            multiple
            // webkitdirectory не даёт полный путь, но позволяет выбрать папку
            {...({ webkitdirectory: "true", directory: "true" } as any)}
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          Даю согласие на обработку и загрузку фото
        </label>
      </div>

      {items.length > 0 && (
        <div className="mt-6 space-y-2">
          <div className="h-2 w-full rounded-full bg-white/10">
            <div
              className="h-2 rounded-full bg-white"
              style={{ width: `${totalProgress}%` }}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {items.map((item, i) => (
              <div
                key={`${item.file.name}-${i}`}
                className="rounded-xl border border-white/10 p-2"
              >
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 opacity-80" />
                  <div className="truncate text-sm">{item.file.name}</div>
                </div>
                <div className="mt-1 text-xs opacity-70">{formatSize(item.file.size)}</div>
                {!item.valid && (
                  <div className="mt-1 flex items-center gap-2 text-xs text-red-300">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {item.reason}
                  </div>
                )}
                <div className="mt-2 h-1.5 w-full rounded-full bg-white/10">
                  <div
                    className="h-1.5 rounded-full bg-white"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={validItems.length === 0 || !consent}
          onClick={handleUpload}
          className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-black disabled:opacity-50"
        >
          {status === "uploading" && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === "uploading" ? "Загружаю..." : "Загрузить"}
        </button>
        {status === "done" && (
          <>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Копировать ссылку на галерею
            </button>
            <Link
              to={`/gallery/${shootId}`}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-black"
            >
              Открыть галерею
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
