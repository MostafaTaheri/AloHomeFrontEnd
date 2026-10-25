import type { ImportKindName } from "@/lib/api/finance/types";

export const IMPORT_KINDS: ImportKindName[] = [
  "Expenses",
  "Levies",
  "ArrearsReport",
  "CapitalWorksPlan",
];

/** Client-side guard only. The server enforces its own limit and answers 413 above it. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export type FileCheck = "ok" | "type" | "tooLarge" | "empty";

export function checkFile(file: Pick<File, "name" | "size">): FileCheck {
  if (!/\.(csv|xlsx)$/i.test(file.name)) return "type";
  if (file.size === 0) return "empty";
  if (file.size > MAX_UPLOAD_BYTES) return "tooLarge";
  return "ok";
}

/** Step the wizard is on, derived from the server status (the backend is authoritative). */
export type WizardStep = "mapping" | "review" | "commit" | "result";

export function stepFor(status: string): WizardStep {
  switch (status) {
    case "Uploaded":
      return "mapping";
    case "Mapped":
      return "review";
    case "Validated":
      return "commit";
    default:
      return "result";
  }
}

export function isDraft(status: string): boolean {
  return status === "Uploaded" || status === "Mapped" || status === "Validated";
}

/** Escapes a value for CSV and neutralises spreadsheet formula injection. */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: unknown[][]): string {
  // BOM so Excel reads UTF-8 (Persian text) correctly.
  return "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
