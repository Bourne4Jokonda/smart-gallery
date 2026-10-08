import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  Loader2,
  Save,
} from "lucide-react";
import { getAuthInstance, getUserProfile, saveUserProfile, type UserProfile } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getAuthInstance().currentUser) {
      throw redirect({ to: "/login" });
    }
  },
  component: SettingsPage,
});

function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [watermarkText, setWatermarkText] = useState("");
  const [watermarkImageFile, setWatermarkImageFile] = useState<File | null>(null);
  const [watermarkImagePreview, setWatermarkImagePreview] = useState<string | null>(null);
  const [watermarkPosition, setWatermarkPosition] = useState<UserProfile["watermarkPosition"]>("bottom-right");
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.35);
  const [watermarkFontFamily, setWatermarkFontFamily] = useState<string | null>(null);
  const [watermarkFontSize, setWatermarkFontSize] = useState<number | null>(null);
  const [watermarkFontWeight, setWatermarkFontWeight] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuthInstance();
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, (u) => {
      if (cancelled) return;
      setUser(u);
      setAuthChecked(true);
      if (!u) {
        window.location.href = "/login";
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    const load = async () => {
      try {
        const data = await getUserProfile(user.uid);
        if (!cancelled && data) {
          setProfile(data);
          setWatermarkText(data.watermarkText ?? "");
          setWatermarkPosition(data.watermarkPosition ?? "bottom-right");
          setWatermarkOpacity(data.watermarkOpacity ?? 0.35);
          setWatermarkFontFamily(data.watermarkFontFamily ?? null);
          setWatermarkFontSize(data.watermarkFontSize ?? null);
          setWatermarkFontWeight(data.watermarkFontWeight ?? null);
        }
      } catch {
        // ignore
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const handleSave = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      let watermarkImageUrl = watermarkImageFile ? null : (profile?.watermarkImageUrl ?? null);
      if (watermarkImageFile) {
        const { uploadToCloudinary, isCloudinaryConfigured } = await import("@/lib/cloudinary");
        if (!isCloudinaryConfigured()) {
          throw new Error("Cloudinary не настроен");
        }
        watermarkImageUrl = await uploadToCloudinary(watermarkImageFile, {
          folder: "smart-gallery/watermarks",
        });
      }

      const payload = {
        watermarkEnabled: true,
        watermarkType: watermarkText.trim() ? "text" : watermarkImageUrl ? "image" : "none",
        watermarkText: watermarkText.trim() || null,
        watermarkImageUrl,
        watermarkPosition,
        watermarkOpacity: watermarkOpacity,
        watermarkFontFamily,
        watermarkFontSize,
        watermarkFontWeight,
      };

      await saveUserProfile(user.uid, payload);
      setProfile((prev) => ({ ...(prev ?? { userId: user.uid }), ...payload }));
      setWatermarkImageFile(null);
      toast.success("Настройки сохранены");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка сохранения";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const preview = useMemo(() => {
    if (!profile?.watermarkEnabled) return null;
    const text = watermarkText.trim() || "Smart Gallery";
    const opacity = watermarkOpacity ?? 0.35;
    const position =
      profile.watermarkPosition === "center"
        ? "center"
        : profile.watermarkPosition === "top-left"
          ? "top-left"
          : "bottom-right";
    const hasImage = profile.watermarkType === "image" && !!profile.watermarkImageUrl;
    return { text, opacity, position, hasImage, imageUrl: profile.watermarkImageUrl };
  }, [profile, watermarkText, watermarkOpacity]);

  if (!authChecked || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const enabled = profile?.watermarkEnabled !== false;
  const previewText = watermarkText.trim() || "Smart Gallery";
  const previewOpacity = watermarkOpacity ?? 0.35;
  const previewPosition =
    watermarkPosition === "center"
      ? "center"
      : watermarkPosition === "top-left"
        ? "top-left"
        : "bottom-right";
  const previewHasImage = (watermarkImagePreview || (profile?.watermarkType === "image" && !!profile?.watermarkImageUrl));
  const previewFontFamily = watermarkFontFamily || profile?.watermarkFontFamily || "inherit";
  const previewFontSize = watermarkFontSize ?? profile?.watermarkFontSize ?? 14;
  const previewFontWeight = watermarkFontWeight || profile?.watermarkFontWeight || "inherit";

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">Настройки профиля</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Здесь будет расширение: watermark, публичность по умолчанию, брендинг и пр.
            </p>
          </div>
          <Link to="/profile" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Назад в кабинет
          </Link>
        </div>

        <section className="mt-8 rounded-2xl border border-border bg-card/50 p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Водяной знак</h2>
                <p className="text-xs text-muted-foreground">Показывается в публичных галереях.</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={Boolean(profile?.watermarkEnabled)}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      watermarkEnabled: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-border"
                />
                Включён
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-xs text-muted-foreground">
                Текст
                <input
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  placeholder="Например: Фотограф Иван"
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
              <label className="flex flex-col gap-2 text-xs text-muted-foreground">
                Логотип
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setWatermarkImageFile(e.target.files?.[0] ?? null)}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
                {(watermarkImagePreview || profile?.watermarkImageUrl) && (
                  <img src={watermarkImagePreview || profile.watermarkImageUrl} alt="" className="h-10 w-auto rounded-lg border border-border object-contain" />
                )}
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-xs text-muted-foreground">
                Положение
                <select
                  value={watermarkPosition}
                  onChange={(e) => setWatermarkPosition(e.target.value as typeof watermarkPosition)}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                >
                  <option value="bottom-right">Справа внизу</option>
                  <option value="center">По центру</option>
                  <option value="top-left">Слева вверху</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-xs text-muted-foreground">
                Прозрачность
                <input
                  type="range"
                  min="0.05"
                  max="0.8"
                  step="0.05"
                  value={watermarkOpacity}
                  onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                  className="mt-2"
                />
                <span className="text-xs">{Math.round(watermarkOpacity * 100)}%</span>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-xs text-muted-foreground">
                Шрифт
                <select
                  value={watermarkFontFamily ?? ""}
                  onChange={(e) => setWatermarkFontFamily(e.target.value || null)}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                >
                  <option value="">По умолчанию</option>
                  <option value="sans-serif">Sans</option>
                  <option value="serif">Serif</option>
                  <option value="monospace">Mono</option>
                  <option value="cursive">Hand</option>
                  <option value="system-ui">System</option>
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs text-muted-foreground">
                  Размер
                  <input
                    type="range"
                    min="10"
                    max="32"
                    step="1"
                    value={watermarkFontSize ?? 14}
                    onChange={(e) => setWatermarkFontSize(Number(e.target.value))}
                    className="mt-2"
                  />
                  <span className="text-xs">{watermarkFontSize ?? 14}px</span>
                </label>
                <label className="flex flex-col gap-2 text-xs text-muted-foreground">
                  Жирность
                  <select
                    value={watermarkFontWeight ?? ""}
                    onChange={(e) => setWatermarkFontWeight(e.target.value || null)}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  >
                    <option value="">По умолчанию</option>
                    <option value="400">Regular</option>
                    <option value="500">Medium</option>
                    <option value="600">Semibold</option>
                    <option value="700">Bold</option>
                  </select>
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" />
              Сохранить настройки
            </button>

            {enabled && (
              <div className="mt-2 rounded-xl border border-border bg-background p-4 text-xs text-muted-foreground">
                <p className="mb-2 font-semibold text-foreground">Превью</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                    <img
                      src="https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=1200&auto=format&fit=crop"
                      alt="preview"
                      className="h-full w-full object-cover"
                    />
                    <div
                      className={`absolute inset-0 flex ${
                        previewPosition === "center"
                          ? "items-center justify-center"
                          : previewPosition === "top-left"
                            ? "items-start justify-start p-4"
                            : "items-end justify-end p-4 pb-8"
                      }`}
                    >
                      <div className="rounded-xl bg-black/0 p-2" style={{ opacity: previewOpacity }}>
                        {previewHasImage && (watermarkImagePreview || profile?.watermarkImageUrl) ? (
                          <img src={watermarkImagePreview || profile.watermarkImageUrl} alt="" className="max-h-10 max-w-[70%] object-contain" />
                        ) : (
                          <span
                            className="text-white drop-shadow-md"
                            style={{
                              fontFamily: previewFontFamily,
                              fontSize: previewFontSize,
                              fontWeight: previewFontWeight,
                            }}
                          >
                            {previewText}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted sm:aspect-[9/16]">
                    <img
                      src="https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=1200&auto=format&fit=crop"
                      alt="preview portrait"
                      className="h-full w-full object-cover"
                    />
                    <div
                      className={`absolute inset-0 flex ${
                        previewPosition === "center"
                          ? "items-center justify-center"
                          : previewPosition === "top-left"
                            ? "items-start justify-start p-4"
                            : "items-end justify-end p-4 pb-8"
                      }`}
                    >
                      <div className="rounded-xl bg-black/0 p-2" style={{ opacity: previewOpacity }}>
                        {previewHasImage && (watermarkImagePreview || profile?.watermarkImageUrl) ? (
                          <img src={watermarkImagePreview || profile.watermarkImageUrl} alt="" className="max-h-10 max-w-[70%] object-contain" />
                        ) : (
                          <span
                            className="text-white drop-shadow-md"
                            style={{
                              fontFamily: previewFontFamily,
                              fontSize: previewFontSize,
                              fontWeight: previewFontWeight,
                            }}
                          >
                            {previewText}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-5xl text-center text-xs text-muted-foreground">
          © 2026 Умная галерея для фотографов
        </div>
      </footer>
    </div>
  );
}
