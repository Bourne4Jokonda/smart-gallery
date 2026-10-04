# Память проекта — Smart Gallery

> Рабочая память проекта. Обновляется при каждом значимом изменении.
> ROADMAP.md — план (этапы). Этот файл — текущий контекст.

## Статус (04.10.2026)

- Этап 1, шаг 1 (пароль на сессию) — СДЕЛАН и задеплоен
- Продакшен: https://aleksandr-faraonov.vercel.app
- Репозиторий: Bourne4Jokonda/smart-gallery, ветка main
- Последний коммит: `15eab53` feat: password-protected public gallery

## Текущая задача

- Проверить пароль в продакшене (задать пароль в кабинете, открыть публичную ссылку в инкогнито)
- После проверки — шаг 2 Этапа 1: «избранное» клиентом

## Что сделано (шаг 1 — пароль)

- `/api/public-shoot`: GET — мета (hasPassword), POST — проверка пароля, потом отдаёт fileUrls
- `/api/set-shoot-password`: POST/DELETE, только владелец (проверка userId)
- `/public-gallery/$id`: экран ввода пароля до фото; без пароля — фото не отдаются
- profile.tsx: кнопка «Пароль» на карточке публичной сессии + модальное окно
- Изоляция: клиент видит только свою сессию, чужие недоступны

## Факты

- Стек: TanStack Start + React + Vite + Firebase (Firestore/Auth) + Cloudinary
- Cloudinary: cloud dmhfqxswo, preset smart-gallery
- Firebase project: smart-gallery-75599
- Папка проекта: C:/Users/Александр/projects/smart-gallery/lovable-export
- Деплой: `vercel deploy --prod` (auth работает, аккаунт bourne4jokonda)
- Firestore rules НЕ опубликованы (CLI 403) — только вручную через Firebase Console
- Секреты в файлах — [REDACTED], не сохранять значения

## Следующие шаги (Этап 1)

- [ ] Избранное клиентом (лайки) — хранить в `shoots/{shootId}/favorites`
- [ ] Фотограф видит избранное клиента в кабинете
- [ ] Водяной знак / логотип фотографа (поле в профиле)
- [ ] Скачивание избранного (ZIP)

## Правило

- Обновлять этот файл при каждом значимом изменении (фича, фикс, деплой)
- Коммитить вместе с кодом
