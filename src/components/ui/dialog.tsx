"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * Modal built on the native <dialog> element, which provides the focus trap, Escape handling,
 * inert background and focus restoration without extra code.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const { t } = useI18n();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop targets the <dialog> itself, not its content.
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[min(92vw,34rem)] rounded-xl border border-line bg-surface p-0 text-fg shadow-xl",
        className,
      )}
    >
      {open ? (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 id={titleId} className="text-base font-semibold">
                {title}
              </h2>
              {description ? (
                <p id={descId} className="mt-1 text-sm text-muted">
                  {description}
                </p>
              ) : null}
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label={t("common.close")}>
              <span aria-hidden="true">✕</span>
            </Button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
              {footer}
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
