import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useLocation,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { Loader2, Menu, UploadCloud, X } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { signOutUser, onUserChange } from "@/lib/firebase";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lovable App" },
      { name: "description", content: "Lovable Generated Project" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "Lovable Generated Project" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const location = useLocation();
  const isPublicGallery = location.pathname.startsWith("/public-gallery/");
  const [user, setUser] = useState<{ uid: string; email: string } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    // Мобильное меню закрывается при смене роута
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    try {
      const unsubscribe = onUserChange((u) => {
        if (u?.email) {
          setUser({ uid: u.uid, email: u.email });
        } else {
          setUser(null);
        }
        setAuthReady(true);
        setAuthError(null);
        router.invalidate();
      });
      return unsubscribe;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Ошибка инициализации авторизации";
      console.error("[root] auth init failed:", e);
      setAuthError(message);
      setAuthReady(true);
    }
  }, [router]);

  if (authError) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Не удалось загрузить авторизацию</h1>
            <p className="mt-2 text-sm text-muted-foreground">{authError}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Обновить страницу
            </button>
          </div>
        </div>
      </QueryClientProvider>
    );
  }

  if (!authReady) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="max-w-md text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Проверяем авторизацию…</p>
          </div>
        </div>
      </QueryClientProvider>
    );
  }

  if (isPublicGallery) {
    // Публичная галерея: своя шапка, без навигации и кнопки «Войти»
    return (
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster theme="dark" position="bottom-center" richColors closeButton />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" className="inline-flex items-center gap-2 font-bold tracking-tight">
            <span className="inline-flex rounded-lg bg-primary p-1.5 text-primary-foreground">SG</span>
            Smart Gallery
          </Link>

          {/* Десктоп: обычная навигация */}
          <nav className="hidden items-center gap-3 text-sm sm:flex">
            {user ? (
              <>
                <span className="text-xs text-muted-foreground">{user.email}</span>
                <Link to="/upload" className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]">
                  <UploadCloud className="h-4 w-4" />
                  Загрузить
                </Link>
                <Link to="/profile" className="rounded-xl border border-border px-3.5 py-2 transition-colors hover:border-primary hover:text-primary">Кабинет</Link>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await signOutUser();
                    } catch {
                      // ignore
                    } finally {
                      setUser(null);
                      router.invalidate();
                      window.location.href = "/login";
                    }
                  }}
                  className="rounded-xl border border-border px-3.5 py-2 transition-colors hover:border-primary hover:text-primary"
                >
                  Выйти
                </button>
              </>
            ) : (
              <Link to="/login" className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]">Войти</Link>
            )}
          </nav>

          {/* Мобильный: бургер */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Закрыть меню" : "Открыть меню"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:border-primary hover:text-primary sm:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Мобильное выпадающее меню */}
        {mobileOpen && (
          <nav className="border-t border-border bg-background px-5 py-4 sm:hidden">
            {user ? (
              <div className="flex flex-col gap-3">
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                <Link
                  to="/upload"
                  onClick={() => setMobileOpen(false)}
                  className="d-btn-primary w-full"
                >
                  <UploadCloud className="h-4 w-4" />
                  Загрузить съёмку
                </Link>
                <Link
                  to="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="d-btn-ghost w-full"
                >
                  Кабинет
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    setMobileOpen(false);
                    try {
                      await signOutUser();
                    } catch {
                      // ignore
                    } finally {
                      setUser(null);
                      router.invalidate();
                      window.location.href = "/login";
                    }
                  }}
                  className="d-btn-ghost w-full"
                >
                  Выйти
                </button>
              </div>
            ) : (
              <Link to="/login" onClick={() => setMobileOpen(false)} className="d-btn-primary w-full">
                Войти
              </Link>
            )}
          </nav>
        )}
      </header>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster theme="dark" position="bottom-center" richColors />
    </QueryClientProvider>
  );
}
