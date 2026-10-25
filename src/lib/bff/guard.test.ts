import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertSameOrigin } from "./guard";

function request(method: string, headers: Record<string, string>) {
  return new Request("http://localhost:3000/api/auth/login", { method, headers });
}

describe("assertSameOrigin", () => {
  beforeEach(() => {
    vi.stubEnv("API_BASE_URL", "http://api.test");
    vi.stubEnv("ALLOWED_ORIGINS", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("does not check safe methods", () => {
    expect(assertSameOrigin(request("GET", {}))).toBeNull();
  });

  it("rejects mutating requests without an Origin header", async () => {
    const response = assertSameOrigin(request("POST", { host: "localhost:3000" }));
    expect(response?.status).toBe(403);
  });

  it("accepts an Origin that matches the host", () => {
    const response = assertSameOrigin(
      request("POST", { origin: "http://localhost:3000", host: "localhost:3000" }),
    );
    expect(response).toBeNull();
  });

  it("rejects a foreign Origin", () => {
    const response = assertSameOrigin(
      request("POST", { origin: "https://evil.example", host: "localhost:3000" }),
    );
    expect(response?.status).toBe(403);
  });
});
