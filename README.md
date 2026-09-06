# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Server route `/api/notify-lead` (Telegram-уведомление)

Серверный route TanStack Start отправляет уведомление в Telegram при сохранении лида. Токен бота читается только на сервере из `process.env.TELEGRAM_BOT_TOKEN` (БЕЗ префикса `VITE_`) и нигде не хранится в коде или клиенте. Задайте значение вручную в Project Settings → Environment Variables.

## Telegram-уведомления о новых лидах (Firebase Cloud Functions v2)

Функция `notifyNewLead` (`functions/index.js`) срабатывает при создании документа в коллекции Firestore `leads` и отправляет сообщение в Telegram:

```
🔥 Новый лид!
Email: ...
Источник: ...
Время: ...
Сайт: Умная галерея
```

Секреты в коде не хранятся — используются переменные окружения `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` (шаблон: `functions/.env.example`).

### 1. Создать бота и получить токен
1. Откройте [@BotFather](https://t.me/BotFather) в Telegram.
2. Команда `/newbot`, задайте имя и username бота.
3. BotFather пришлёт токен вида `123456789:AA...` — это `TELEGRAM_BOT_TOKEN`.

### 2. Получить chat_id
1. Напишите своему боту любое сообщение (например `/start`).
2. Откройте в браузере: `https://api.telegram.org/bot<ТОКЕН>/getUpdates`
3. В ответе найдите `"chat":{"id":123456789,...}` — это `TELEGRAM_CHAT_ID`.
   Для группы: добавьте бота в группу, напишите сообщение и возьмите отрицательный `id` (например `-1001234567890`).

### 3. Задать секреты и задеплоить
```sh
npm i -g firebase-tools
firebase login
cd functions && npm install && cd ..

firebase functions:secrets:set TELEGRAM_BOT_TOKEN
firebase functions:secrets:set TELEGRAM_CHAT_ID

firebase deploy --only functions:notifyNewLead
```

Логи: `firebase functions:log --only notifyNewLead` (токен в логи не пишется).

### Локальный запуск
Скопируйте `functions/.env.example` в `functions/.env.local`, заполните значения и запустите:
```sh
cd functions && npm run serve
```

> Деплой выполняется на вашей стороне: он требует Firebase CLI и учётных данных проекта, которых нет в этой среде. Код готов к деплою как есть.
