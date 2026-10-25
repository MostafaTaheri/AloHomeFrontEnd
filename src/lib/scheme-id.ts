/** Parses a scheme id from a route segment. Only positive integers are valid ids. */
export function parseSchemeId(value: string): number | null {
  if (!/^\d{1,9}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 ? id : null;
}

const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Route segments that carry a resource id must be GUIDs; anything else is a 404. */
export function isGuid(value: string): boolean {
  return GUID.test(value);
}
