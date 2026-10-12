import { useEffect } from "react";

/**
 * Анимация появления секций (reveal on scroll).
 * Ставит класс .in на элементы .reveal, когда они попадают в viewport.
 * При prefers-reduced-motion или без IntersectionObserver — сразу ставит .in.
 *
 * ВАЖНО: если этот хук не подключить на странице с классами .reveal,
 * элементы останутся невидимыми (opacity: 0), но кликабельными.
 */
export function useReveal(): void {
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
}
