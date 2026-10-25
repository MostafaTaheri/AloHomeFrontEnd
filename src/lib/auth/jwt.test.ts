import { describe, expect, it } from "vitest";
import { decodeJwtPayload, extractRoles, sessionFromToken } from "./jwt";

function token(payload: unknown): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode(payload)}.sig`;
}

const NOW = Date.UTC(2026, 0, 1);
const future = Math.floor(NOW / 1000) + 3600;

describe("decodeJwtPayload", () => {
  it("returns null for missing or malformed tokens", () => {
    expect(decodeJwtPayload(undefined)).toBeNull();
    expect(decodeJwtPayload("")).toBeNull();
    expect(decodeJwtPayload("a.b")).toBeNull();
    expect(decodeJwtPayload("a.!!!.c")).toBeNull();
    expect(decodeJwtPayload(token([1, 2]))).toBeNull();
  });

  it("decodes UTF-8 payloads", () => {
    expect(decodeJwtPayload(token({ sub: "u1", name: "علی" }))?.name).toBe("علی");
  });
});

describe("extractRoles", () => {
  it("collects roles from every supported claim without duplicates", () => {
    const roles = extractRoles({
      realm_access: { roles: ["Admin"] },
      roles: ["Admin", "Resident"],
      role: "Support",
      "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": ["Auditor"],
      resource_access: { app: { roles: ["Editor"] } },
    });
    expect(roles.sort()).toEqual(["Admin", "Auditor", "Editor", "Resident", "Support"]);
  });
});

describe("sessionFromToken", () => {
  it("builds a session for a valid admin token", () => {
    const session = sessionFromToken(
      token({ sub: "u1", exp: future, phone_number: "+989121234567", roles: ["admin"] }),
      NOW,
    );
    expect(session).toMatchObject({
      id: "u1",
      phoneNumber: "+989121234567",
      isAdmin: true,
      expiresAt: future * 1000,
    });
  });

  it("rejects expired tokens and tokens without a subject", () => {
    expect(sessionFromToken(token({ sub: "u1", exp: future - 7200 }), NOW)).toBeNull();
    expect(sessionFromToken(token({ exp: future }), NOW)).toBeNull();
  });

  it("is not an admin without the role", () => {
    expect(
      sessionFromToken(token({ sub: "u1", exp: future, roles: ["Resident"] }), NOW)?.isAdmin,
    ).toBe(false);
  });
});
