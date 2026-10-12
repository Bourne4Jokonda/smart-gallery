import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { isFirebaseConfigured, saveLead } from "@/lib/firebase";
import {
  ArrowDown,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  Images,
  Loader2,
  Lock,
  ScanFace,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
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

/* ---------- Контент ---------- */

const heroPhotos = [
  "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800&auto=format&fit=crop",
];

const proofRaw = [
  "https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1532712938310-34cb3982ef74?w=400&auto=format&fit=crop",
];

// Индексы кадров, которые AI отметил как лучшие (совпадают с proofRaw)
const bestPicks = [0, 2, 4];

const pains = [
  {
    stat: "8 часов",
    title: "Отбор в один вечер",
    text: "Пролистать 1000 снимков после свадьбы — рутина, которая съедает вечер и портит глаза.",
  },
  {
    stat: "2 дня",
    title: "Клиент ждёт галерею",
    text: "Пока вы отбираете, клиент пишет в мессенджер: «А когда галерея?» — и репутация тает.",
  },
  {
    stat: "−30%",
    title: "Дубликаты и брак",
    text: "Похожие кадры, смазанные, закрытые глаза — всё нужно заметить вручную, и всегда что-то ускользает.",
  },
];

const features = [
  {
    icon: ScanFace,
    main: true,
    title: "Оценка эмоций и резкости",
    text: "Каждый кадр получает балл: выражение лиц, открытость глаз, резкость, свет. Вы видите цифру — и понимаете, почему кадр в подборке.",
  },
  {
    icon: Images,
    title: "Группировка дубликатов",
    text: "Похожие снимки сворачиваются в стопки — остаётся выбрать один из серии.",
  },
  {
    icon: Wand2,
    title: "Композиция и свет",
    text: "Балл за композицию, баланс и свет — ловит кадры, где модель и рамка сходятся.",
  },
  {
    icon: Zap,
    title: "Галерея за 10 минут",
    text: "Ссылка с паролем, ваш водяной знак и ZIP-архив — всё готово к отправке клиенту.",
  },
];

const steps = [
  {
    num: "01",
    icon: UploadCloud,
    title: "Загрузите съёмку",
    text: "Raw или jpg, целой папкой или архивом. Никакой предобработки не нужно.",
  },
  {
    num: "02",
    icon: Sparkles,
    title: "ИИ отбирает лучшие",
    text: "Оценки, дубликаты, флаги брака — вы проверяете результат, а не листаете тысячу кадров.",
  },
  {
    num: "03",
    icon: BadgeCheck,
    title: "Отправьте клиенту",
    text: "Ссылка + пароль, водяной знак, скачивание ZIP. Клиент открывает галерею сам.",
  },
];

const securityPoints = [
  {
    icon: ShieldCheck,
    title: "Хранение в России",
    text: "Все фото и данные — на серверах в РФ. Никаких зарубежных облаков.",
  },
  {
    icon: Lock,
    title: "Шифрование",
    text: "Галереи доступны только по ссылке и паролю. Без пароля — ни одного кадра.",
  },
  {
    icon: Trash2,
    title: "Автоудаление через 30 дней",
    text: "После завершения заказа съёмка удаляется автоматически. Вы контролируете срок.",
  },
];

const plans = [
  {
    name: "Пробный",
    price: "0 ₽",
    period: "одна съёмка, навсегда",
    features: ["1 съёмка · до 100 фото", "ИИ-отбор и дубликаты", "Галерея с паролем"],
    featured: false,
    cta: "Начать бесплатно",
  },
  {
    name: "Старт",
    price: "990 ₽",
    period: "/ месяц",
    features: [
      "10 съёмок в месяц",
      "Неограниченно фото",
      "Водяной знак + логотип",
      "ZIP-скачивание для клиента",
    ],
    featured: true,
    cta: "Попробовать 14 дней",
  },
  {
    name: "Профи",
    price: "2 990 ₽",
    period: "/ месяц",
    features: [
      "Безлимитные съёмки",
      "Брендинг студии",
      "Приоритетная обработка",
      "Поддержка в Telegram",
    ],
    featured: false,
    cta: "Связаться",
  },
];

const faq = [
  {
    q: "Как загружать фото?",
    a: "Целой папкой или ZIP-архивом. Raw, jpg, heic — формат не важен, ИИ принимает всё, что выдаёт камера.",
  },
  {
    q: "ИИ удалит или изменит мои фото?",
    a: "Нет. ИИ только оценивает и сортирует — оригиналы не трогает. Вы всегда видите исходник рядом с оценкой.",
  },
  {
    q: "Можно ли брендировать галерею?",
    a: "Да. Текстовый водяной знак или ваш логотип: шрифт, размер, прозрачность, позиция — всё настраивается в профиле с живым превью.",
  },
  {
    q: "Где хранятся данные клиентов?",
    a: "Только на серверах в России. Галерея доступна по ссылке и паролю, после завершения заказа удаляется автоматически.",
  },
  {
    q: "Как клиент получит галерею?",
    a: "Вы отправляете ссылку и пароль. Клиент открывает галерею без регистрации, смотрит фото и скачивает ZIP одним архивом.",
  },
  {
    q: "Когда можно отменить подписку?",
    a: "В любой момент, одним кликом в кабинете. Доступ сохранится до конца оплаченного периода.",
  },
];

/* ---------- Компонент ---------- */

function Landing() {
  const formRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Анимация появления секций (reveal)
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = document.querySelectorAll(".reveal");
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.1 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

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
      <section className="px-5 pb-20 pt-14 sm:px-8 sm:pt-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div className="reveal">
            <span className="d-badge">
              <span className="d-badge-dot" />
              Новая ниша для фотографов
            </span>
            <h1 className="d-display mt-6 text-[clamp(2.5rem,6.2vw,5rem)]">
              Отбор <span className="text-primary">1000 кадров</span> за 10 минут — а не 8 часов
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              ИИ отмечает лучшие фото свадьбы, группирует дубликаты и собирает
              галерею с паролем. Клиент получает ссылку — вы получаете вечер обратно.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#lead"
                className="d-btn-primary"
              >
                Попробовать бесплатно
                <ArrowDown className="h-4 w-4" />
              </a>
              <a href="#proof" className="d-btn-ghost">
                Смотреть, как это работает
              </a>
            </div>
            <p className="mt-5 text-sm font-semibold text-muted-foreground/70">
              1 съёмка бесплатно · без карты · фото хранятся в России
            </p>
          </div>

          <div className="reveal relative">
            <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
              <figure className="d-photo">
                <img src={heroPhotos[0]} alt="Свадебная пара" loading="lazy" />
              </figure>
              <figure className="d-photo mt-11 sm:mt-14">
                <img src={heroPhotos[1]} alt="Свадебный кадр" loading="lazy" />
              </figure>
            </div>
            <span className="d-photo-tag">87 лучших</span>
          </div>
        </div>
      </section>

      {/* PROOF — до/после */}
      <section id="proof" className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="reveal">
            <span className="d-kicker">Результат</span>
            <h2 className="d-display mt-4 text-[clamp(1.9rem,4vw,3rem)]">
              Было 1000 кадров. Стало <span className="text-primary">87 лучших</span>.
            </h2>
            <p className="mt-5 max-w-2xl text-muted-foreground">
              Слева — сырая стопка после свадьбы. Справа — то же самое после
              отбора ИИ: дубликаты свёрнуты, лучшие кадры отмечены голубым.
            </p>
          </div>
          <div className="reveal mt-10 grid gap-6 sm:gap-8 md:grid-cols-2">
            <div>
              <div className="d-ba-label">
                <b>До</b> · 1000 фото
              </div>
              <div className="d-ba-grid d-ba-gray">
                {proofRaw.map((src) => (
                  <img key={src} src={src} alt="" loading="lazy" />
                ))}
              </div>
            </div>
            <div>
              <div className="d-ba-label">
                <b>После</b> · 87 фото
              </div>
              <div className="d-ba-grid">
                {proofRaw.map((src, i) =>
                  bestPicks.includes(i) ? (
                    <span key={src} className="d-pick">
                      <img src={src} alt="Лучший кадр, отобранный ИИ" loading="lazy" />
                      <span className="d-pick-dot" />
                    </span>
                  ) : (
                    <img key={src} src={src} alt="" loading="lazy" />
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PAIN — крупные цифры */}
      <section id="pain" className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="reveal">
            <span className="d-kicker">Знакомо?</span>
            <h2 className="d-display mt-4 text-[clamp(1.9rem,4vw,3rem)]">
              Отбор съедает больше, чем съёмка
            </h2>
          </div>
          <div className="reveal mt-10 grid gap-4 sm:grid-cols-3">
            {pains.map((p) => (
              <div key={p.title} className="d-card">
                <span className="d-stat">{p.stat}</span>
                <h3 className="mt-2 text-lg font-bold">{p.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {p.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES — вертикальный список */}
      <section id="features" className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="reveal">
            <span className="d-kicker">Что делает ИИ</span>
            <h2 className="d-display mt-4 text-[clamp(1.9rem,4vw,3rem)]">
              Не просто фильтр — <span className="text-primary">второй глаз</span>
            </h2>
            <p className="mt-5 max-w-2xl text-muted-foreground">
              ИИ оценивает каждый кадр по нескольким осям и оставляет только то,
              что вы бы отобрали сами — только быстрее.
            </p>
          </div>
          <div className="reveal mt-10">
            {features.map((f) => (
              <div
                key={f.title}
                className={`d-feature ${f.main ? "d-feature-main" : ""}`}
              >
                <div className="d-feature-ico">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="d-feature-title">{f.title}</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {f.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW — три шага */}
      <section id="how" className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="reveal">
            <span className="d-kicker">Процесс</span>
            <h2 className="d-display mt-4 text-[clamp(1.9rem,4vw,3rem)]">
              Три шага — <span className="text-primary">и галерея готова</span>
            </h2>
          </div>
          <div className="reveal mt-10 grid gap-4 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.num} className="d-card">
                <div className="d-step-num">{s.num}</div>
                <div className="d-feature-ico mb-4">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {s.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STAT BAND — крупные цифры */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="reveal mx-auto max-w-6xl">
          <div className="d-stat-band">
            <div className="d-stat-nums">
              <span className="d-big-num text-primary">1500</span>
              <span className="d-arrow">→</span>
              <span className="d-big-num">30 сек</span>
            </div>
            <div>
              <h2 className="d-feature-title text-xl sm:text-2xl">
                Полная свадебная съёмка — за половину чашки кофе
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                1500 фото обрабатываются и сортируются за 30 секунд. Вы тратите
                время на проверку результата, а не на прокрутку.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* EARLY ACCESS */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="reveal mx-auto max-w-6xl">
          <div className="d-early">
            <div>
              <span className="d-kicker">Ранний доступ</span>
              <h2 className="d-display mt-4 text-[clamp(1.7rem,3.4vw,2.6rem)]">
                490 ₽/мес навсегда — для первых{" "}
                <span className="text-primary">10 фотографов</span>
              </h2>
              <p className="mt-4 max-w-lg text-muted-foreground">
                Пока сервис в раннем доступе, цена фиксируется на всю подписку.
                После первых десяти — тариф вырастет до 990 ₽.
              </p>
            </div>
            <div className="d-early-price">
              <div className="d-early-sum">490 ₽</div>
              <div className="d-early-per">/ месяц, навсегда</div>
              <a href="#lead" className="d-btn-primary mt-5 w-full justify-center">
                Взять ранний доступ
              </a>
              <div className="d-early-note">осталось 7 мест из 10</div>
            </div>
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="reveal">
            <span className="d-kicker">Доверие</span>
            <h2 className="d-display mt-4 text-[clamp(1.9rem,4vw,3rem)]">
              Фото клиентов — <span className="text-primary">под защитой</span>
            </h2>
          </div>
          <div className="reveal mt-10 grid gap-4 sm:grid-cols-3">
            {securityPoints.map((s) => (
              <div key={s.title} className="d-sec-item">
                <div className="d-feature-ico">
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {s.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="price" className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="reveal">
            <span className="d-kicker">Тарифы</span>
            <h2 className="d-display mt-4 text-[clamp(1.9rem,4vw,3rem)]">
              Начните бесплатно. <span className="text-primary">Масштабируйтесь потом.</span>
            </h2>
          </div>
          <div className="reveal mt-12 grid gap-4 sm:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`d-price ${plan.featured ? "d-price-pop" : ""}`}
              >
                {plan.featured && <span className="d-pop-tag">Популярный</span>}
                <h3 className="text-base font-bold">{plan.name}</h3>
                <div className="d-price-sum">{plan.price}</div>
                <div className="d-price-per">{plan.period}</div>
                <ul className="mb-7 mt-6 flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2.5 text-sm text-muted-foreground"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="#lead"
                  className={`${plan.featured ? "d-btn-primary" : "d-btn-ghost"} w-full justify-center`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
          <p className="reveal mt-8 text-center text-sm text-muted-foreground">
            Первым 10 фотографам — тариф Старт за 490 ₽/мес навсегда.{" "}
            <a
              href="https://t.me/ai_gallery_helper"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              Напишите нам
            </a>{" "}
            — выдадим промокод.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="reveal">
            <span className="d-kicker">Вопросы</span>
            <h2 className="d-display mt-4 text-[clamp(1.9rem,4vw,3rem)]">
              Частые вопросы
            </h2>
          </div>
          <div className="reveal mt-10 grid gap-2.5">
            {faq.map((item, i) => (
              <div key={item.q} className="d-faq-item">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="d-faq-q"
                  aria-expanded={openFaq === i}
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={`d-faq-chev ${openFaq === i ? "rotate-180" : ""}`}
                  />
                </button>
                <div
                  className={`d-faq-a ${openFaq === i ? "d-faq-open" : ""}`}
                >
                  <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground sm:px-6">
                    {item.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LEAD FORM */}
      <section id="lead" className="px-5 py-16 sm:px-8 sm:py-24" ref={formRef}>
        <div className="reveal mx-auto max-w-2xl">
          <div className="d-lead">
            <span className="d-kicker d-kicker-center">Ранний доступ</span>
            <h2 className="d-display mt-4 text-[clamp(1.7rem,3.6vw,2.6rem)]">
              Первым получить <span className="text-primary">ранний доступ</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-muted-foreground">
              Оставьте почту — пришлём ссылку на пробную съёмку и расскажем про
              оставшиеся места по 490 ₽.
            </p>
            {status === "done" ? (
              <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-6 py-8">
                <CheckCircle2 className="h-10 w-10 text-primary" />
                <p className="text-lg font-semibold">Заявка принята!</p>
                <p className="text-sm text-muted-foreground">
                  Мы отправили ссылку на{" "}
                  <span className="text-foreground">{email}</span>. Проверьте
                  почту — письмо уже летит к вам.
                </p>
                <Link
                  to="/upload"
                  className="d-btn-primary mt-2"
                >
                  <UploadCloud className="h-4 w-4" />
                  Загрузить съёмку сейчас
                </Link>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-8 space-y-3" noValidate>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="ваш@email.ru"
                  aria-label="Email"
                  className={`d-input ${error ? "border-destructive" : ""}`}
                />
                {error && (
                  <p className="text-left text-sm text-destructive">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="d-btn-primary w-full justify-center disabled:opacity-70"
                >
                  {status === "sending" ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Отправляем…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Получить доступ
                    </>
                  )}
                </button>
              </form>
            )}
            <p className="mt-5 text-xs font-semibold text-muted-foreground/70">
              Никакого спама. Только доступ и важные обновления.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground/50">
              Загружая фото, вы соглашаетесь с обработкой данных в соответствии с{" "}
              <Link to="/privacy" className="underline hover:text-primary">
                Политикой конфиденциальности
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-center text-sm text-muted-foreground/70 sm:flex-row sm:text-left">
          <span>© 2026 Умная галерея для фотографов</span>
          <div className="flex items-center gap-6">
            <Link
              to="/privacy"
              className="transition-colors hover:text-foreground"
            >
              Политика конфиденциальности
            </Link>
            <a
              href="https://t.me/ai_gallery_helper"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              Поддержка в Telegram
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
