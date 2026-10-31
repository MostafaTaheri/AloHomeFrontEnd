import { describe, expect, it } from "vitest";
import { isUploadPath, sanitizeBackendPath } from "./path";

describe("sanitizeBackendPath (client relay)", () => {
  it("allows the scheme tree", () => {
    expect(sanitizeBackendPath(["schemes", "mine"])).toBe("schemes/mine");
    expect(sanitizeBackendPath(["schemes", "12", "arrears", "summary"])).toBe(
      "schemes/12/arrears/summary",
    );
  });

  it("allows the product catalogue, organisations and the portfolio", () => {
    expect(sanitizeBackendPath(["product", "governance"])).toBe("product/governance");
    expect(sanitizeBackendPath(["organisations", "mine"])).toBe("organisations/mine");
    expect(sanitizeBackendPath(["portfolio"])).toBe("portfolio");
  });

  it("is case-insensitive about the allowed roots", () => {
    expect(sanitizeBackendPath(["Schemes", "12", "Context"])).toBe("schemes/12/context");
  });

  it("keeps guids intact", () => {
    const id = "3f2b8a52-0c4e-4d6e-9d56-0a8d1a7c9b11";
    expect(sanitizeBackendPath(["schemes", "1", "imports", id, "preview"])).toBe(
      `schemes/1/imports/${id}/preview`,
    );
  });

  it("refuses back-office routes for a client session", () => {
    expect(sanitizeBackendPath(["backoffice", "schemes"])).toBeNull();
    expect(sanitizeBackendPath(["backoffice", "users", "x", "activate"])).toBeNull();
    expect(sanitizeBackendPath(["backoffice", "organisations"])).toBeNull();
    expect(sanitizeBackendPath(["backoffice", "audit-logs"])).toBeNull();
  });

  it("refuses other API areas", () => {
    expect(sanitizeBackendPath(["authentication", "login"])).toBeNull();
    expect(sanitizeBackendPath(["health"])).toBeNull();
    expect(sanitizeBackendPath(["buildings"])).toBeNull();
  });

  it("refuses traversal, encoded separators and odd characters", () => {
    expect(sanitizeBackendPath(["schemes", "..", "authentication"])).toBeNull();
    expect(sanitizeBackendPath(["schemes", "1/2"])).toBeNull();
    expect(sanitizeBackendPath(["schemes", "1%2f2"])).toBeNull();
    expect(sanitizeBackendPath(["schemes", "1", "a.b"])).toBeNull();
    expect(sanitizeBackendPath(["schemes", ""])).toBeNull();
  });

  it("refuses empty and overly deep paths", () => {
    expect(sanitizeBackendPath([])).toBeNull();
    expect(sanitizeBackendPath(Array.from({ length: 11 }, () => "schemes"))).toBeNull();
  });
});

describe("sanitizeBackendPath (back-office relay)", () => {
  it("allows the back-office trees", () => {
    expect(sanitizeBackendPath(["backoffice", "schemes"], "backoffice")).toBe("backoffice/schemes");
    expect(sanitizeBackendPath(["backoffice", "users"], "backoffice")).toBe("backoffice/users");
    expect(sanitizeBackendPath(["backoffice", "pilot", "feedback"], "backoffice")).toBe(
      "backoffice/pilot/feedback",
    );
    expect(sanitizeBackendPath(["backoffice", "demo", "seed"], "backoffice")).toBe(
      "backoffice/demo/seed",
    );
    expect(
      sanitizeBackendPath(
        ["backoffice", "schemes", "3", "finance", "project-invoices"],
        "backoffice",
      ),
    ).toBe("backoffice/schemes/3/finance/project-invoices");
  });

  it("allows organisations, audit logs, evidence and pilot agreements", () => {
    for (const root of ["organisations", "audit-logs", "evidence", "pilot-agreements"]) {
      expect(sanitizeBackendPath(["backoffice", root], "backoffice")).toBe(`backoffice/${root}`);
    }
    expect(sanitizeBackendPath(["backoffice", "evidence", "security"], "backoffice")).toBe(
      "backoffice/evidence/security",
    );
  });

  it("does not expose the client scheme tree or unknown back-office areas", () => {
    expect(sanitizeBackendPath(["schemes", "1", "context"], "backoffice")).toBeNull();
    expect(sanitizeBackendPath(["backoffice", "secrets"], "backoffice")).toBeNull();
    expect(sanitizeBackendPath(["backoffice"], "backoffice")).toBeNull();
  });
});

describe("isUploadPath", () => {
  const id = "3f2b8a52-0c4e-4d6e-9d56-0a8d1a7c9b11";

  it("accepts only the import upload, retry and document extraction endpoints", () => {
    expect(isUploadPath("schemes/12/imports")).toBe(true);
    expect(isUploadPath(`schemes/12/imports/${id}/retry`)).toBe(true);
    expect(isUploadPath("schemes/12/ai/document-extractions")).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isUploadPath("schemes/12/expenses/flags")).toBe(false);
    expect(isUploadPath(`schemes/12/imports/${id}/commit`)).toBe(false);
    expect(isUploadPath("schemes/abc/imports")).toBe(false);
    expect(isUploadPath("backoffice/schemes")).toBe(false);
    expect(isUploadPath(`schemes/12/ai/document-extractions/${id}/accept`)).toBe(false);
  });
});
