import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { LogOut, Plus } from "lucide-react";
import { getAuthInstance, signOutUser, type User } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export function AppHeader() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const auth = getAuthInstance();
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!cancelled) setUser(u);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-5 sm:px-8">
        <Link to="/profile" className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            SG
          </span>
          <span className="text-base font-bold tracking-tight">Smart&nbsp;Gallery</span>
        </Link>
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {user?.email ?? ""}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void signOutUser().catch(() => {});
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </button>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Загрузить
          </Link>
        </div>
      </div>
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="border-t border-border px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl text-center text-xs text-muted-foreground">
        © 2026 Умная галерея для фотографов
      </div>
    </footer>
  );
}
