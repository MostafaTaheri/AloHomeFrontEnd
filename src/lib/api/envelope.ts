/**
 * The API wraps every success in `{ succeeded, data }` (GeneralResponseDto). These helpers accept
 * both the wrapped and the bare form so a gateway change does not break the screens.
 */
export interface Envelope<T> {
  succeeded?: boolean;
  data?: T | null;
}

export function unwrap<T>(body: unknown): T {
  if (body && typeof body === "object" && !Array.isArray(body) && "data" in body) {
    const wrapped = body as Envelope<T>;
    if (wrapped.data !== undefined && wrapped.data !== null) return wrapped.data;
  }
  return body as T;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** Normalises a list endpoint that may return a bare array or a PaginatedResult. */
export function asPage<T>(value: unknown): Page<T> {
  if (Array.isArray(value)) {
    return {
      items: value as T[],
      page: 1,
      pageSize: value.length || 1,
      totalCount: value.length,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    };
  }
  const v = (value ?? {}) as Partial<Page<T>>;
  const items = Array.isArray(v.items) ? v.items : [];
  const pageSize =
    typeof v.pageSize === "number" && v.pageSize > 0 ? v.pageSize : items.length || 1;
  const totalCount = typeof v.totalCount === "number" ? v.totalCount : items.length;
  const page = typeof v.page === "number" && v.page > 0 ? v.page : 1;
  const totalPages =
    typeof v.totalPages === "number" ? v.totalPages : Math.max(1, Math.ceil(totalCount / pageSize));
  return {
    items,
    page,
    pageSize,
    totalCount,
    totalPages,
    hasNextPage: v.hasNextPage ?? page < totalPages,
    hasPreviousPage: v.hasPreviousPage ?? page > 1,
  };
}

/** Always an array, for endpoints documented as lists. */
export function asList<T>(value: unknown): T[] {
  return asPage<T>(value).items;
}
