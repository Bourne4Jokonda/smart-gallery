/**
 * Cloud Functions (v2) — уведомление в Telegram при создании лида.
 *
 * Триггер: создание документа в коллекции Firestore `leads`.
 * Секреты берутся ТОЛЬКО из переменных окружения:
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 */
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = defineSecret("TELEGRAM_CHAT_ID");

const NOT_SET = "не указано";

/** Формат: 03.09.2026, 05:18 (МСК) */
function formatMoscowTime(value) {
  let date = null;

  if (value && typeof value.toDate === "function") {
    // Firestore Timestamp
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === "number") {
    date = new Date(value);
  } else if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
    else return value;
  }

  if (!date || Number.isNaN(date.getTime())) return NOT_SET;

  const formatted = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  return `${formatted} (МСК)`;
}

/** Экранирование для parse_mode: HTML */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendTelegramMessage(token, chatId, text) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  const body = await response.text();

  if (!response.ok) {
    // В логи попадает только статус и ответ Telegram — токен никогда не логируется.
    throw new Error(`Telegram API ${response.status}: ${body.slice(0, 500)}`);
  }

  return body;
}

exports.notifyNewLead = onDocumentCreated(
  {
    document: "leads/{leadId}",
    region: "europe-west1",
    secrets: [TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID],
    retry: false,
  },
  async (event) => {
    const leadId = event.params.leadId;
    const data = event.data?.data();

    if (!data) {
      logger.warn("Пустой снапшот документа лида", { leadId });
      return;
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      logger.error("Не заданы TELEGRAM_BOT_TOKEN и/или TELEGRAM_CHAT_ID", {
        leadId,
        hasToken: Boolean(token),
        hasChatId: Boolean(chatId),
      });
      return;
    }

    const email = data.email ? String(data.email) : NOT_SET;
    const source = data.source ? String(data.source) : NOT_SET;
    const time = formatMoscowTime(data.createdAt);

    const text = [
      "🔥 Новый лид!",
      `Email: ${escapeHtml(email)}`,
      `Источник: ${escapeHtml(source)}`,
      `Время: ${escapeHtml(time)}`,
      "Сайт: Умная галерея",
    ].join("\n");

    try {
      await sendTelegramMessage(token, chatId, text);
      logger.info("Уведомление о лиде отправлено в Telegram", { leadId, source });
    } catch (error) {
      logger.error("Не удалось отправить уведомление в Telegram", {
        leadId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  },
);
