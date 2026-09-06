import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { isFirebaseConfigured, saveLead } from "@/lib/firebase";
import {
  ArrowDown,
  BadgeCheck,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  FolderSearch,
  HeartCrack,
  Images,
  Loader2,
  Lock,
  ScanFace,
  Send,
  ShieldCheck,
  Sparkles,
  Timer,
  UploadCloud,
  Wand2,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI-фотограф: отбор 1000 фото за 10 минут — Умная галерея" },
      {
        name: "description",
        content:
          "Умная галерея для фотографов: AI отбирает лучшие кадры со съёмки за минуты вместо часов. Попробуйте AI-отбор бесплатно.",
      },
      { property: "og:title", content: "AI-фотограф: отбор 1000 фото за 10 минут" },
      {
        property: "og:description",
        content:
          "Умная галерея для фотографов: AI отбирает лучшие кадры со съёмки за минуты вместо часов.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

const rawPhotos = [
  "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1532712938310-34cb3982ef74?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1595407753234-0882f1e77954?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?w=400&auto=format&fit=crop",
];

const bestPhotos = [
  "https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1519741497674-611481863552?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1606800052052-a08af7148866?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1529634806980-85c3dd6d34ac?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1460978812857-470ed1c77af0?w=600&auto=format&fit=crop",
];

const demoRaw = [
  "https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1532712938310-34cb3982ef74?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1595407753234-0882f1e77954?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400&auto=format&fit=crop",
];

const demoBest = [
  "https://images.unsplash.com/photo-1519741497674-611481863552?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1606800052052-a08af7148866?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1529634806980-85c3dd6d34ac?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1460978812857-470ed1c77af0?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1471897488648-5eae4ac6686b?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&auto=format&fit=crop",
];

const pains = [
  {
    icon: Clock3,
    title: "8 часов на отбор",
    text: "После каждой съёмки вы тратите целый рабочий день, чтобы вручную просмотреть тысячу похожих кадров.",
  },
  {
    icon: HeartCrack,
    title: "Усталость и ошибки",
    text: "К вечеру глаз «замыливается»: лучшие кадры теряются, а клиент получает не самые сильные фото.",
  },
  {
    icon: FolderSearch,
    title: "Клиент ждёт неделями",
    text: "Клиент ждёт неделями — пока идёт отбор, нервничает и пишет в мессенджеры.",
  },
];

const solutions = [
  {
    icon: ScanFace,
    title: "Анализ резкости и эмоций",
    text: "AI проверяет каждый кадр: фокус, открытые глаза, живые эмоции и выражения лиц.",
  },
  {
    icon: Images,
    title: "Группировка дублей",
    text: "Похожие кадры складываются в серии, и из каждой выбирается один самый сильный.",
  },
  {
    icon: Wand2,
    title: "Оценка композиции и света",
    text: "Алгоритм оценивает экспозицию, баланс белого и композицию как опытный фоторедактор.",
  },
  {
    icon: Zap,
    title: "Готово за 10 минут",
    text: "Загрузили карточку памяти — получили готовую галерею лучших фото. Дальше только ваша обработка.",
  },
];

const steps = [
  {
    num: "01",
    icon: UploadCloud,
    title: "Загрузите съёмку",
    text: "Перетащите до 1500 фото (JPEG/RAW) прямо в браузер. Ничего устанавливать не нужно.",
  },
  {
    num: "02",
    icon: Sparkles,
    title: "AI отбирает лучшее",
    text: "За ~10 минут сервис разбирает серии, отсеивает брак и ранжирует кадры по качеству.",
  },
  {
    num: "03",
    icon: BadgeCheck,
    title: "Проверьте и отдайте клиенту",
    text: "Вы утверждаете финальный список и отправляете готовую галерею ссылкой для клиента в тот же день.",
  },
];

const plans = [
  {
    name: "Пробный",
    price: "0 ₽",
    period: "первая съёмка",
    features: [
      "Первая съёмка",
      "До 500 фото",
      "AI-отбор лучших",
      "Без цветокоррекции",
    ],
    featured: false,
    cta: "Начать бесплатно",
  },
  {
    name: "Старт",
    price: "990 ₽",
    period: "в месяц",
    features: [
      "До 5 съёмок в месяц",
      "До 1500 фото в съёмку",
      "AI-отбор и группировка",
      "Базовая цветокоррекция",
      "Галерея для клиента",
    ],
    featured: true,
    cta: "Выбрать тариф",
  },
  {
    name: "Профи",
    price: "2 990 ₽",
    period: "в месяц",
    features: [
      "До 15 съёмок в месяц",
      "До 3000 фото в съёмку",
      "AI-отбор и группировка",
      "Продвинутая цветокоррекция",
      "Приоритетная обработка",
      "Персональный менеджер",
    ],
    featured: false,
    cta: "Выбрать тариф",
  },
];

const securityPoints = [
  {
    icon: ShieldCheck,
    title: "Хранение в РФ",
    text: "Файлы хранятся на серверах в России. Соответствие 152-ФЗ.",
  },
  {
    icon: Lock,
    title: "Шифрование",
    text: "Все данные передаются по защищённому соединению.",
  },
  {
    icon: Clock3,
    title: "Удаление через 30 дней",
    text: "Файлы автоматически удаляются через 30 дней или по запросу.",
  },
];

const faq = [
  {
    q: "AI заменит мой вкус при отборе?",
    a: "Нет. AI снимает рутину — отсеивает брак и дубли, а финальное слово всегда за вами. Вы утверждаете каждый кадр перед отправкой клиенту.",
  },
  {
    q: "Какие форматы и объёмы поддерживаются?",
    a: "JPEG и RAW основных камер (Canon, Nikon, Sony, Fujifilm). До 1500 фото на съёмку в бесплатном тарифе, до 2000 — в платных.",
  },
  {
    q: "Мои фотографии в безопасности?",
    a: "Да. Фото используются только для вашего отбора, не попадают в обучение моделей и удаляются с серверов через 30 дней после закрытия галереи.",
  },
  {
    q: "Что если AI ошибётся и удалит хороший кадр?",
    a: "Ничего не удаляется безвозвратно: все отсеянные фото остаются в папке «Отбор AI», и вы можете вернуть любой кадр одним кликом.",
  },
  {
    q: "Нужно ли что-то устанавливать?",
    a: "Нет, всё работает в браузере: загрузили карточку памяти — получили готовую галерею. Есть версии для телефона и компьютера.",
  },
  {
    q: "А если у меня свадьба на 3000 фото?",
    a: "Студия обрабатывает до 10 000 фото за съёмку, разбивка по эпизодам (церемония, банкет, прогулка) идёт автоматически.",
  },
];

function Landing() {
  const formRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setError("Введите корректный email, например foto@studio.ru");
      return;
    }
    setError("");
    setStatus("sending");
    try {
      if (!isFirebaseConfigured()) {
        throw new Error("Firebase не настроен");
      }
      await saveLead(value);
      localStorage.setItem("smart-gallery-email", value);
      setStatus("done");

      toast.success("Заявка отправлена!", {
        description: "Мы пришлём ссылку на бесплатный AI-отбор первой съёмки.",
      });
    } catch {
      setStatus("idle");
      toast.error("Не удалось отправить заявку", {
        description: "Проверьте подключение к интернету и попробуйте ещё раз.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* HERO */}
      <header className="relative overflow-hidden px-5 pt-16 pb-20 sm:px-8 sm:pt-24">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium tracking-wide text-muted-foreground">
            <Camera className="h-3.5 w-3.5 text-primary" />
            Новая ниша для фотографов
          </p>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
            AI-фотограф: отбор 1000 фото за{" "}
            <span className="text-primary">10 минут</span>, а не 8 часов.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            AI отберёт брак, дубли и лучшие кадры. Вы только проверите результат.
          </p>
          <Link
            to="/upload"
            className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110 active:scale-[0.98]"
          >
            Попробовать AI-отбор бесплатно
            <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
          </Link>


          {/* Collage before/after */}
          <div className="mt-14 grid grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1.5">
                {rawPhotos.map((src, j) => (
                  <div
                    key={src}
                    className="relative aspect-square overflow-hidden rounded-md bg-muted"
                  >
                    <img
                      src={src}
                      alt={`Сырой неотобранный кадр со съёмки ${j + 1}`}
                      loading="lazy"
                      className="h-full w-full object-cover opacity-70 grayscale"
                    />
                    <div className="absolute inset-0 bg-background/45" />
                  </div>
                ))}
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                До: 1000 сырых кадров
              </p>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                {bestPhotos.map((src, j) => (
                  <div
                    key={src}
                    className="overflow-hidden rounded-md ring-2 ring-primary/60 shadow-lg shadow-primary/20"
                  >
                    <img
                      src={src}
                      alt={`Лучший кадр, отобранный AI ${j + 1}`}
                      loading="lazy"
                      className="aspect-square h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                После: 87 лучших фото
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* PAINS */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Знакомо каждому фотографу
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {pains.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
              >
                <div className="mb-4 inline-flex rounded-xl bg-muted p-3">
                  <p.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            Что делает AI
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Ваш личный фоторедактор, который не устаёт
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {solutions.map((s) => (
              <div
                key={s.title}
                className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
              >
                <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3">
                  <s.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STEPS */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Как это работает
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {steps.map((s) => (
              <div
                key={s.num}
                className="relative rounded-2xl border border-border bg-card p-6"
              >
                <span className="absolute right-5 top-4 text-4xl font-extrabold text-primary/20">
                  {s.num}
                </span>
                <div className="mb-4 inline-flex rounded-xl bg-primary p-3">
                  <s.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI DEMO */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Посмотрите, что умеет AI
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-sm text-muted-foreground sm:text-base">
            Слева — исходные фото со съёмки. Справа — то, что AI отобрал.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {demoRaw.map((src, j) => (
                  <div
                    key={src}
                    className="relative aspect-square overflow-hidden rounded-md bg-muted"
                  >
                    <img
                      src={src}
                      alt={`Исходное фото со съёмки ${j + 1}`}
                      loading="lazy"
                      className="h-full w-full object-cover opacity-60 grayscale"
                    />
                    <div className="absolute inset-0 bg-background/50" />
                  </div>
                ))}
              </div>
              <p className="text-xs font-medium text-muted-foreground">До: исходники</p>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {demoBest.map((src, j) => (
                  <div
                    key={src}
                    className="overflow-hidden rounded-md ring-2 ring-primary/70 shadow-lg shadow-primary/20"
                  >
                    <img
                      src={src}
                      alt={`Отобранный AI кадр ${j + 1}`}
                      loading="lazy"
                      className="aspect-square h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs font-medium text-primary">После: отбор AI</p>
            </div>
          </div>
          <p className="mt-8 text-center text-sm font-semibold text-muted-foreground">
            Одна съёмка. 1500 фото. 30 секунд обработки.
          </p>
        </div>
      </section>

      {/* EARLY ACCESS */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl rounded-3xl border border-primary/40 bg-card p-8 text-center sm:p-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            🎯 Ранний доступ
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            Сервис в бета-тесте. Первым 10 фотографам — тариф Старт за 490 ₽/мес
            навсегда (скидка 50%). Места ограничены.
          </p>
          <button
            onClick={scrollToForm}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110 active:scale-[0.98]"
          >
            Занять место за 490 ₽
          </button>
          <p className="mt-4 text-xs text-muted-foreground/60">
            Осталось 7 мест из 10
          </p>
        </div>
      </section>

      {/* SECURITY */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            🔒 Ваши фото под защитой
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {securityPoints.map((s) => (
              <div
                key={s.title}
                className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
              >
                <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3">
                  <s.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Простые цены
          </h2>
          <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-primary/40 bg-primary/10 px-6 py-4 text-center">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
              <Timer className="h-4 w-4" />
              Первым 10 фотографам — первая съёмка БЕСПЛАТНО (до 1500 фото)
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`flex flex-col rounded-2xl border p-6 ${
                  plan.featured
                    ? "border-primary bg-card shadow-lg shadow-primary/10 sm:-translate-y-2"
                    : "border-border bg-card"
                }`}
              >
                {plan.featured && (
                  <span className="mb-3 w-fit rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                    Популярный
                  </span>
                )}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="mt-3 text-3xl font-extrabold">
                  {plan.price}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {plan.period}
                  </span>
                </p>
                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={scrollToForm}
                  className="mt-8 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Первым 10 фотографам — тариф Старт за 490 ₽/мес навсегда.{" "}
            <a href="https://t.me/ai_gallery_helper" target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">
              Напишите нам
            </a>{" "}
            — выдадим промокод.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Частые вопросы
          </h2>
          <div className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card">
            {faq.map((item, i) => (
              <div key={item.q}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left"
                  aria-expanded={openFaq === i}
                >
                  <span className="text-base font-semibold">{item.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-primary transition-transform duration-300 ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`grid transition-all duration-300 ease-in-out ${
                    openFaq === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FORM */}
      <section className="px-5 py-16 sm:px-8 sm:py-24" ref={formRef}>
        <div className="mx-auto max-w-xl rounded-3xl border border-primary/30 bg-card p-7 text-center sm:p-10">
          <div className="mx-auto mb-5 inline-flex rounded-2xl bg-primary p-3.5">
            <Eye className="h-7 w-7 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Попробуйте на своей съёмке
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Оставьте email — пришлём ссылку на бесплатный AI-отбор первой съёмки.
          </p>
          <p className="mt-4 text-sm font-semibold text-primary">
            Без регистрации. Первые 10 фотографов получают съёмку бесплатно — навсегда
          </p>
          {status === "done" ? (
            <div className="mt-7 flex flex-col items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-6 py-8">
              <CheckCircle2 className="h-10 w-10 text-primary" />
              <p className="text-lg font-semibold">Заявка принята!</p>
              <p className="text-sm text-muted-foreground">
                Мы отправили ссылку на <span className="text-foreground">{email}</span>.
                Проверьте почту — письмо уже летит к вам.
              </p>
              <Link
                to="/upload"
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
              >
                <UploadCloud className="h-4 w-4" />
                Загрузить съёмку сейчас
              </Link>
            </div>

          ) : (
            <form onSubmit={submit} className="mt-7 space-y-3" noValidate>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError("");
                }}
                placeholder="ваш@email.ru"
                className={`w-full rounded-xl border bg-background px-5 py-4 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-primary ${
                  error ? "border-destructive" : "border-input"
                }`}
              />
              {error && (
                <p className="text-left text-sm text-destructive">{error}</p>
              )}
              <button
                type="submit"
                disabled={status === "sending"}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-4 text-base font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-70"
              >
                {status === "sending" ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Отправляем…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Хочу попробовать AI-отбор
                  </>
                )}
              </button>
            </form>
          )}
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground/60">
            Загружая фото, вы соглашаетесь с обработкой данных в соответствии с{" "}
            <Link to="/privacy" className="underline hover:text-primary">
              Политикой конфиденциальности
            </Link>
            .
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div>
            <Link to="/privacy" className="text-sm text-muted-foreground hover:text-primary hover:underline">
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
