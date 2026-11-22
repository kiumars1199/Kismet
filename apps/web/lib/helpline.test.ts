import { describe, expect, it } from "vitest";
import { HELPLINE, helplineLinks } from "./helpline";

describe("help line config (F8)", () => {
  it("has a source URL and a checked date", () => {
    expect(HELPLINE.source_url).toMatch(/^https:\/\/www\.ncpgambling\.org\//);
    expect(HELPLINE.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(HELPLINE.checked))).toBe(false);
  });
  it("builds call, text and chat links from the config", () => {
    expect(helplineLinks()).toEqual({ call: "tel:+18006973738", text: "sms:+18006973738", chat: "https://www.ncpgambling.org/chat/" });
    expect(HELPLINE.number_display).toBe("1-800-MY-RESET");
  });
});
