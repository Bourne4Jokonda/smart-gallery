import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { getAuthInstance } from "@/lib/firebase";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  beforeLoad: () => {
    if (typeof window !== "undefined" && localStorage.getItem("smart-gallery-user")) {
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
        const res = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const userPayload = { uid: res.user.uid, email: res.user.email ?? email.trim() };
        localStorage.setItem("smart-gallery-user", JSON.stringify(userPayload));
        toast.success("Аккаунт создан");
      } else {
        const res = await signInWithEmailAndPassword(auth, email.trim(), password);
        const userPayload = { uid: res.user.uid, email: res.user.email ?? email.trim() };
        localStorage.setItem("smart-gallery-user", JSON.stringify(userPayload));
        toast.success("Вход выполнен");
      }
      window.location.href = "/";
    } catch (e) {
      const raw =
        e instanceof FirebaseError
          ? e.code || e.message || ""
          : "";
      let message = "Ошибка авторизации";
      if (raw.includes("invalid-credential") || raw.includes("wrong-password")) {
        message = "Неверный email или пароль";
      } else if (raw.includes("user-not-found")) {
        message = "Аккаунт не найден. Сначала зарегистрируйтесь";
      } else if (raw.includes("email-already-in-use")) {
        message = "Такой email уже зарегистрирован. Войдите в аккаунт";
      } else if (raw.includes("weak-password")) {
        message = "Пароль слишком слабый. Используйте минимум 6 символов";
      } else if (raw.includes("invalid-email")) {
        message = "Некорректный email";
      } else if (raw.includes("too-many-requests")) {
        message = "Слишком много попыток. Подождите немного и попробуйте снова";
      } else if (raw.includes("network-request-failed")) {
        message = "Нет подключения к интернету";
      }
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    try {
      await signOut(auth);
      localStorage.removeItem("smart-gallery-user");
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
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
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
              type="submit"
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
          </form>
        </div>
      </main>
    </div>
  );
}
