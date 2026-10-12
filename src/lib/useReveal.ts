import { useEffect } from "react";

/**
 * Анимация появления секций (reveal on scroll).
 *
 * Двойная защита от невидимых секций:
 * 1. IntersectionObserver — добавляет .in, когда элемент попадает в viewport.
 * 2. Таймаут-фолбэк: если через 1.2с ни один элемент не получил .in
 *    (headless-режим, кастомный WebView, IO не генерирует события) —
 *    ставим .in всем. Элементы всегда видны, анимация — только украшение.
 *
 * При prefers-reduced-motion — сразу .in всем.
 */
export function useReveal(): void {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    if (els.length === 0) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }

    let revealed = false;
    const markAll = () => {
      if (revealed) return;
      revealed = true;
      els.forEach((el) => el.classList.add("in"));
    };
    const fallbackTimer = window.setTimeout(() => {
      const anyVisible = document.querySelector(".reveal.in");
      if (!anyVisible) markAll();
    }, 1200);

    if (!("IntersectionObserver" in window)) {
      markAll();
      return () => window.clearTimeout(fallbackTimer);
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

    return () => {
      window.clearTimeout(fallbackTimer);
      io.disconnect();
    };
  }, []);
}
