import { describe, expect, it } from "vitest";
import { findSetCookie, parseSetCookie } from "./set-cookie";

describe("parseSetCookie", () => {
  it("reads name, value and lifetime attributes", () => {
    const parsed = parseSetCookie(
      "alohomeAccessToken=abc.def.ghi; path=/; expires=Wed, 01 Jan 2031 00:00:00 GMT; max-age=300; httponly",
    );
    expect(parsed?.name).toBe("alohomeAccessToken");
    expect(parsed?.value).toBe("abc.def.ghi");
    expect(parsed?.maxAge).toBe(300);
    expect(parsed?.expires?.getUTCFullYear()).toBe(2031);
  });

  it("decodes percent-encoded values and tolerates bad encoding", () => {
    expect(parseSetCookie("a=hello%20world")?.value).toBe("hello world");
    expect(parseSetCookie("a=100%")?.value).toBe("100%");
  });

  it("rejects headers without a name", () => {
    expect(parseSetCookie("=value")).toBeNull();
    expect(parseSetCookie("novalue")).toBeNull();
  });
});

describe("findSetCookie", () => {
  it("returns the matching cookie", () => {
    const headers = ["a=1; path=/", "b=2; path=/"];
    expect(findSetCookie(headers, "b")?.value).toBe("2");
    expect(findSetCookie(headers, "c")).toBeNull();
  });
});
