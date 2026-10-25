import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)} {...rest} />
    </div>
  );
}

export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className="bg-surface-2 text-muted" {...props} />;
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className="divide-y divide-line" {...props} />;
}

export function TR({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("hover:bg-surface-2/60", className)} {...rest} />;
}

export function TH({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn("px-5 py-2.5 text-start text-xs font-semibold whitespace-nowrap", className)}
      {...rest}
    />
  );
}

export function TD({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-5 py-3 align-middle", className)} {...rest} />;
}
