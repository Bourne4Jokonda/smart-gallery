import { useEffect } from "react";

/**
 * Анимация появления секций (reveal on scroll).
 *
 * Тройная защита от невидимого контента:
 * 1. IntersectionObserver — добавляет .in, когда элемент попадает в viewport.
 * 2. MutationObserver — ловит НОВЫЕ .reveal-элементы, добавленные после
 *    mount (например, карточки съёмок после загрузки данных из Firebase).
 * 3. Индивидуальный таймаут 2с на каждый элемент: если IO так и не
 *    сработал (headless, кастомный WebView) — элемент гарантированно
 *    получает .in. Контент никогда не пропадает, анимация — украшение.
 *
 * При prefers-reduced-motion — сразу .in всем.
 */
export function useReveal(): void {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const revealAll = () => {
      document.querySelectorAll(".reveal:not(.in)").forEach((el) =>
        el.classList.add("in"),
      );
    };

    if (reduce) {
      revealAll();
      return;
    }

    // Таймеры-фолбэки: WeakMap<Element, timerId>
    const timers = new WeakMap<Element, number>();

    let io: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              en.target.classList.add("in");
              io!.unobserve(en.target);
            }
          });
        },
        { threshold: 0.1 },
      );
    }

    const watch = (el: Element) => {
      if (timers.has(el)) return;
      // Гарантия видности: через 2с элемент получит .in в любом случае
      timers.set(
        el,
        window.setTimeout(() => {
          el.classList.add("in");
          io?.unobserve(el);
        }, 2000),
      );
      io?.observe(el);
    };

    // Существующие на момент mount элементы
    document.querySelectorAll(".reveal").forEach(watch);

    // Новые элементы (React рендерит карточки после загрузки данных)
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (!(n instanceof HTMLElement)) return;
          if (n.classList?.contains("reveal")) watch(n);
          n.querySelectorAll?.(".reveal").forEach(watch);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      io?.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);
}
