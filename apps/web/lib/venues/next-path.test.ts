import { describe, expect, it } from "vitest";
import { safeNext } from "./next-path";

describe("safeNext", () => {
  it("keeps same-site paths (path, query, hash)", () => {
    expect(safeNext("/?us=0")).toBe("/?us=0");
    expect(safeNext("/bets/x")).toBe("/bets/x");
    expect(safeNext("/m/1?side=0#why")).toBe("/m/1?side=0#why");
  });
  it("refuses other sites, relative paths and loops to /state", () => {
    for (const v of [null, undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "bets", "/state?next=/", "/state", "/state/x"])
      expect(safeNext(v), String(v)).toBeNull();
  });
  it("refuses control characters the URL parser strips (tab, LF, CR) and DEL, in any position or mix", () => {
    for (const v of ["/\t/evil.example", "/\n/evil.example", "/\r/evil.example", "/\r\n/evil.example", "\t//evil.example", "/\t\\evil.example",
      "/ok\u0000", "/ok\u007f", "/\u001f/evil.example"])
      expect(safeNext(v), JSON.stringify(v)).toBeNull();
  });
  it("refuses the decoded forms of %09 %0A %0D and an encoded backslash (Next decodes searchParams)", () => {
    for (const raw of ["%2F%09%2Fevil.example", "%2F%0A%2Fevil.example", "%2F%0D%2Fevil.example", "%2F%5Cevil.example", "%2F%5C%2Fevil.example", "%2F%2Fevil.example"])
      expect(safeNext(decodeURIComponent(raw)), raw).toBeNull();
  });
});
