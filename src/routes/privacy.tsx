import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, Lock, Server, Shield, Trash2 } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Политика конфиденциальности — Умная галерея" },
      {
        name: "description",
        content:
          "Политика конфиденциальности Умной галереи: как мы обрабатываем фото и персональные данные фотографов и их клиентов.",
      },
      { property: "og:title", content: "Политика конфиденциальности — Умная галерея" },
      {
        property: "og:description",
        content:
          "Как Умная галерея обрабатывает фото и персональные данные в соответствии с 152-ФЗ.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
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
            Политика конфиденциальности
          </h1>
          <p className="mt-4 text-muted-foreground">
            Последнее обновление: 6 сентября 2026 г.
          </p>

          <section className="mt-10 space-y-4">
            <h2 className="text-xl font-semibold sm:text-2xl">1. Общие положения</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Сервис «Умная галерея» уважает вашу конфиденциальность. Мы обрабатываем только
              те данные, которые необходимы для работы AI-отбора фотографий, и не передаём их
              третьим лицам в маркетинговых целях.
            </p>
          </section>

          <section className="mt-10 space-y-4">
            <h2 className="text-xl font-semibold sm:text-2xl">2. Обработка фото (152-ФЗ)</h2>
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center gap-3">
                <span className="inline-flex rounded-xl bg-primary/15 p-2.5">
                  <Shield className="h-5 w-5 text-primary" />
                </span>
                <span className="font-semibold">Биометрические данные</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Фото, загруженные на /upload, содержат биометрические данные. Хранятся в
                Firebase Storage (регион europe-west3, ЕС) и передаются в Google Gemini API
                (США) исключительно для AI-отбора лучших кадров. Основание — ваше явное
                согласие (чекбокс на странице загрузки). Срок хранения — 7 дней с момента
                загрузки, после автоматическое удаление по запросу на{" "}
                <a
                  href="https://t.me/ai_gallery_helper"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  @ai_gallery_helper
                </a>
                . Вы можете отозвать согласие и запросить удаление ранее.
              </p>
            </div>
          </section>

          <section className="mt-10 space-y-4">
            <h2 className="text-xl font-semibold sm:text-2xl">3. Хранение и защита</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              <li className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
                <Server className="h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">Firebase Storage</p>
                  <p className="text-sm text-muted-foreground">
                    Файлы хранятся в защищённом облачном хранилище с контролем доступа.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
                <Lock className="h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">Шифрование</p>
                  <p className="text-sm text-muted-foreground">
                    Передача данных происходит по HTTPS. Доступ к файлам ограничен.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
                <Trash2 className="h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">Автоматическое удаление</p>
                  <p className="text-sm text-muted-foreground">
                    Фото удаляются через 7 дней после загрузки или раньше по вашему запросу.
                  </p>
                </div>
              </li>
            </ul>
          </section>

          <section className="mt-10 space-y-4">
            <h2 className="text-xl font-semibold sm:text-2xl">4. Контакты</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Вопросы по обработке данных можно задать в Telegram:{" "}
              <a
                href="https://t.me/ai_gallery_helper"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary hover:underline"
              >
                @ai_gallery_helper
              </a>
              .
            </p>
          </section>
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
