"use client";

import { useEffect, useRef } from "react";

/**
 * Accessibility behaviour for modal dialogs:
 *  - Escape closes the dialog
 *  - body scroll is locked while open
 *  - Tab/Shift+Tab are trapped within the dialog
 *  - focus is restored to the previously-focused element on close
 *
 * Usage:
 *   const ref = useModalA11y(open, () => setOpen(false));
 *   return open && <div role="dialog" aria-modal="true" ref={ref}>…</div>;
 *
 * onClose is read through a ref so passing an inline arrow function doesn't
 * re-run the effect on every render.
 */
export function useModalA11y(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const FOCUSABLE =
      'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  return ref;
}
