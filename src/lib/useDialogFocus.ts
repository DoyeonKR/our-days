"use client";

import { useEffect, useRef } from "react";

const stack: HTMLElement[] = [];
const candidates = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Only the topmost sheet owns Escape/Tab; closing restores its invoking control. */
export function useDialogFocus(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const invokingFocus = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) {
      // React autoFocus runs before passive effects. Remember the invoking control
      // while closed, ignoring focus entering the newly committed dialog itself.
      invokingFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const remember = (event: FocusEvent) => {
        if (event.target instanceof HTMLElement && !ref.current?.contains(event.target)) invokingFocus.current = event.target;
      };
      const rememberPointer = (event: PointerEvent) => {
        const target = event.target instanceof Element ? event.target.closest<HTMLElement>(candidates) : null;
        // WebKit does not always focus a button on mouse/touch activation.
        if (target && !ref.current?.contains(target)) invokingFocus.current = target;
      };
      document.addEventListener("focusin", remember, true);
      document.addEventListener("pointerdown", rememberPointer, true);
      return () => {
        document.removeEventListener("focusin", remember, true);
        document.removeEventListener("pointerdown", rememberPointer, true);
      };
    }
    const dialog = ref.current;
    if (!dialog) return;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previous = invokingFocus.current?.isConnected ? invokingFocus.current : active && !dialog.contains(active) ? active : null;
    stack.push(dialog);
    const initial = dialog.querySelector<HTMLElement>("[data-dialog-initial]");
    if (initial) initial.focus({ preventScroll: true });
    else if (!dialog.contains(document.activeElement)) dialog.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (stack.at(-1) !== dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close.current();
      } else if (event.key === "Tab") {
        const controls = [...dialog.querySelectorAll<HTMLElement>(candidates)].filter((el) => el.tabIndex >= 0 && !el.closest('[hidden], [inert]') && el.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (!first || !last) {
          event.preventDefault();
          dialog.focus({ preventScroll: true });
        } else if (!dialog.contains(document.activeElement) || document.activeElement === dialog || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus({ preventScroll: true });
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      const wasTop = stack.at(-1) === dialog;
      const index = stack.lastIndexOf(dialog);
      if (index !== -1) stack.splice(index, 1);
      if (wasTop) {
        if (previous?.isConnected) previous.focus({ preventScroll: true });
        else stack.at(-1)?.focus({ preventScroll: true });
      }
    };
  }, [open]);
  return ref;
}
