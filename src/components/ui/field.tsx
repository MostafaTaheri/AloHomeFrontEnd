import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

const control =
  "block w-full rounded-md border bg-surface px-3 text-sm text-fg placeholder:text-muted/70 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export function Field({
  id,
  label,
  hint,
  error,
  optional,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-baseline gap-2 text-sm font-medium">
        {label}
        {optional ? <span className="text-xs font-normal text-muted">({optional})</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface ControlProps {
  id: string;
  invalid?: boolean;
  hasHint?: boolean;
}

export function Input({
  id,
  invalid,
  hasHint,
  className,
  ref,
  ...rest
}: ControlProps & InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return (
    <input
      id={id}
      ref={ref}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-error` : hasHint ? `${id}-hint` : undefined}
      className={cn(control, "h-10", invalid ? "border-danger" : "border-line", className)}
      {...rest}
    />
  );
}

export function Select({
  id,
  invalid,
  hasHint,
  className,
  ref,
  children,
  ...rest
}: ControlProps & SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return (
    <select
      id={id}
      ref={ref}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-error` : hasHint ? `${id}-hint` : undefined}
      className={cn(control, "h-10", invalid ? "border-danger" : "border-line", className)}
      {...rest}
    >
      {children}
    </select>
  );
}
