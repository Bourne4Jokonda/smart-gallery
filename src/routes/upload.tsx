import { createFileRoute } from "@tanstack/react-router";
import UploadPage from "@/pages/Upload";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Загрузите свою съёмку — Умная галерея" },
      {
        name: "description",
        content:
          "Загрузите до 2000 фото со съёмки, и AI отберёт лучшие кадры за 10 минут. Поддержка JPG, PNG и RAW до 20 МБ.",
      },
      { property: "og:title", content: "Загрузите свою съёмку — Умная галерея" },
      {
        property: "og:description",
        content:
          "Перетащите папку с фото — AI отберёт лучшие кадры за 10 минут вместо 8 часов ручной работы.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UploadPage,
});
