import { describe, expect, it } from "vitest";
import { checkFile, csvCell, isDraft, stepFor, toCsv, MAX_UPLOAD_BYTES } from "./constants";

describe("import helpers", () => {
  it("validates files", () => {
    expect(checkFile({ name: "a.csv", size: 10 })).toBe("ok");
    expect(checkFile({ name: "A.XLSX", size: 10 })).toBe("ok");
    expect(checkFile({ name: "a.pdf", size: 10 })).toBe("type");
    expect(checkFile({ name: "a.csv", size: 0 })).toBe("empty");
    expect(checkFile({ name: "a.csv", size: MAX_UPLOAD_BYTES + 1 })).toBe("tooLarge");
  });
  it("maps status to step", () => {
    expect(stepFor("Uploaded")).toBe("mapping");
    expect(stepFor("Mapped")).toBe("review");
    expect(stepFor("Validated")).toBe("commit");
    for (const s of ["Committed", "Failed", "Superseded", "Other"])
      expect(stepFor(s)).toBe("result");
    expect(isDraft("Mapped")).toBe(true);
    expect(isDraft("Committed")).toBe(false);
  });
  it("escapes csv and blocks formulas", () => {
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell("x,y")).toBe('"x,y"');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell(null)).toBe("");
    expect(toCsv([["a", "b"]])).toBe("﻿a,b");
  });
});
