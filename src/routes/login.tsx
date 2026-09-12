import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { getAuthInstance } from "@/lib/firebase";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  beforeLoad: () => {
    if (typeof window !== "undefined" && getAuthInstance().currentUser) {
      throw redirect({ to: "/" });
    }
  },
});

function LoginPage() {
  const auth = getAuthInstance();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error("Укажите email и пароль");
      return;
    }
    setBusy(true);
    try {
      if (mode === "register") {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
        toast.success("Аккаунт создан");
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        toast.success("Вход выполнен");
      }
      window.location.href = "/";
    } catch (e) {
      const message =
        e instanceof FirebaseError
          ? e.message || "Ошибка авторизации"
          : "Неизвестная ошибка";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    try {
      await signOut(auth);
      toast.success("Вы вышли");
      window.location.href = "/login";
    } catch (e) {
      toast.error("Не удалось выйти");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <header className="border-b border-border px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center gap-2 font-bold tracking-tight">
          <span className="inline-flex rounded-lg bg-primary p-1.5">
            <Camera className="h-4 w-4 text-primary-foreground" />
          </span>
          Умная галерея
        </div>
      </header>

      <main className="px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-sm rounded-3xl border border-border bg-card p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold">
            {mode === "login" ? "Вход" : "Регистрация"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Войдите, чтобы видеть свои фотосессии с любого устройства.
          </p>
          <div className="mt-6 space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="you@example.com"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">
                Пароль
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="••••••••"
              />
            </label>
            <button
              onClick={submit}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {mode === "login" ? "Входим…" : "Создаём аккаунт…"}
                </>
              ) : mode === "login" ? (
                "Войти"
              ) : (
                "Создать аккаунт"
              )}
            </button>
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="w-full text-center text-xs text-muted-foreground hover:text-primary"
            >
              {mode === "login"
                ? "Нет аккаунта? Зарегистрироваться"
                : "Уже есть аккаунт? Войти"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
