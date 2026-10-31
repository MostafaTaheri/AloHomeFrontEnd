import { describe, expect, it } from "vitest";
import { createTranslator } from "@/i18n/translator";
import { ApiError, describeError, hasErrorCode, isRetryable, parseErrorBody } from "./error";

const { t } = createTranslator("en");

describe("parseErrorBody", () => {
  it("extracts code, message and details, moving the correlation id out of details", () => {
    const error = parseErrorBody(400, {
      succeeded: false,
      error: {
        code: "Validation",
        message: "Invalid",
        details: [
          "Phone number is invalid.",
          "Code: Validation, Message: Invalid",
          "Share this correlationId with support [abc-123]",
        ],
      },
    });
    expect(error.code).toBe("Validation");
    expect(error.details).toEqual(["Phone number is invalid."]);
    expect(error.correlationId).toBe("abc-123");
  });

  it("prefers the response header correlation id", () => {
    expect(parseErrorBody(500, {}, "header-id").correlationId).toBe("header-id");
  });

  it("tolerates unexpected bodies", () => {
    expect(parseErrorBody(502, "<html>").message).toBe("HTTP 502");
    expect(parseErrorBody(500, null).details).toEqual([]);
  });
});

describe("describeError", () => {
  it("shows the API's own message for 4xx errors", () => {
    expect(
      describeError(new ApiError(409, "Conflict", "x", ["Unit already has an owner."]), t),
    ).toBe("Unit already has an owner.");
  });

  it("hides server internals for 5xx errors", () => {
    expect(describeError(new ApiError(500, null, "boom", ["stack trace"]), t)).toBe(
      t("errors.server"),
    );
  });

  it("maps network failures and unknown throwables", () => {
    expect(describeError(new ApiError(0, null, "offline"), t)).toBe(t("errors.network"));
    expect(describeError(new Error("x"), t)).toBe(t("errors.generic"));
  });
});

describe("isRetryable", () => {
  it("retries network and server errors only", () => {
    expect(isRetryable(new ApiError(0, null, ""))).toBe(true);
    expect(isRetryable(new ApiError(503, null, ""))).toBe(true);
    expect(isRetryable(new ApiError(404, null, ""))).toBe(false);
    expect(isRetryable(new Error())).toBe(false);
  });
});

describe("describeError status mapping", () => {
  const cases: [number, string][] = [
    [400, "errors.validation"],
    [422, "errors.validation"],
  ];
  it.each(cases)("maps %i to a validation message when the API gives no detail", (status, key) => {
    const message = describeError(new ApiError(status, "Validation", "x", []), t);
    expect(message).toBe(t(key as never));
  });

  it("treats conflicts, payload limits and unsupported types as final, not retryable", () => {
    for (const status of [409, 413, 415]) {
      expect(isRetryable(new ApiError(status, "X", "x", []))).toBe(false);
    }
  });

  it("retries network failures and server errors only", () => {
    expect(isRetryable(new ApiError(0, "Network", "x", []))).toBe(true);
    expect(isRetryable(new ApiError(503, "Unavailable", "x", []))).toBe(true);
    expect(isRetryable(new ApiError(404, "NotFound", "x", []))).toBe(false);
  });
});

describe("hasErrorCode", () => {
  it("matches the prefixed and the bare numeric code", () => {
    expect(hasErrorCode(new ApiError(400, "App_AloHome_430010", "x"), 430010)).toBe(true);
    expect(hasErrorCode(new ApiError(400, "430010", "x"), 430010)).toBe(true);
  });

  it("does not match a different code or a non-API error", () => {
    expect(hasErrorCode(new ApiError(400, "App_AloHome_4300101", "x"), 430010)).toBe(false);
    expect(hasErrorCode(new ApiError(400, null, "x"), 430010)).toBe(false);
    expect(hasErrorCode(new Error("x"), 430010)).toBe(false);
  });
});
