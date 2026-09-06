import { createFileRoute } from "@tanstack/react-router";

const CHAT_ID = "969149212";

export const Route = createFileRoute("/api/notify-lead")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { ok: false, error: "Тело запроса должно быть JSON" },
            { status: 400 },
          );
        }

        const { email, source } = (body ?? {}) as { email?: unknown; source?: unknown };
        if (typeof email !== "string" || typeof source !== "string" || !email || !source) {
          return Response.json(
            { ok: false, error: "Поля email и source обязательны и должны быть строками" },
            { status: 400 },
          );
        }

        const token = process.env["TELEGRAM_BOT_TOKEN"];
        if (!token) {
          console.error("[notify-lead] TELEGRAM_BOT_TOKEN не задан на сервере");
          return Response.json(
            { ok: false, error: "Уведомление не настроено на сервере" },
            { status: 500 },
          );
        }

        const time = new Date().toLocaleString("ru-RU", {
          timeZone: "Europe/Moscow",
        });

        const text = `🔥 Новый лид с Умной галереи!\nEmail: ${email}\nИсточник: ${source}\nВремя: ${time}`;

        try {
          const tgResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: CHAT_ID, text }),
          });

          if (!tgResponse.ok) {
            const tgBody = await tgResponse.text().catch(() => "");
            console.error("[notify-lead] Ошибка Telegram API:", tgResponse.status, tgBody);
            return Response.json(
              { ok: false, error: "Telegram API вернул ошибку" },
              { status: 502 },
            );
          }

          return Response.json({ ok: true });
        } catch (error) {
          console.error(
            "[notify-lead] Сетевая ошибка при обращении к Telegram:",
            error instanceof Error ? error.message : String(error),
          );
          return Response.json(
            { ok: false, error: "Не удалось связаться с Telegram API" },
            { status: 502 },
          );
        }
      },
    },
  },
});
