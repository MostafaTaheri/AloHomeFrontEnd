"use client";

import { useI18n } from "@/i18n/provider";
import { Button } from "./button";
import { Dialog } from "./dialog";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  busy = false,
  destructive = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  busy?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={title}
      description={body}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
