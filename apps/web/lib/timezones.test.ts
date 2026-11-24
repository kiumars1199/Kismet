import { describe, expect, it } from "vitest";
import { timeZoneOptions } from "./timezones";

const SUPPORTED = ["Africa/Abidjan", "America/New_York", "Europe/London"];

describe("timeZoneOptions", () => {
  it("includes the saved zone and UTC when the browser's list lacks them", () => {
    const o = timeZoneOptions("UTC", SUPPORTED);
    expect(o).toContain("UTC");
    expect(o.indexOf("UTC")).toBeLessThan(o.indexOf("Africa/Abidjan"));   // UTC isn't first-in-list by accident of sorting: it must not sit under a real zone's name
    expect(o.filter((z) => z === "UTC")).toHaveLength(1);
  });
  it("adds an unknown saved zone once", () => {
    const o = timeZoneOptions("Asia/Calcutta", SUPPORTED);
    expect(o.filter((z) => z === "Asia/Calcutta")).toHaveLength(1);
    expect(o).toEqual(expect.arrayContaining(SUPPORTED));
  });
  it("leaves a known saved zone alone", () => {
    expect(timeZoneOptions("Europe/London", SUPPORTED)).toEqual(["UTC", ...SUPPORTED]);
  });
  it("works when Intl cannot list zones", () => {
    expect(timeZoneOptions("Asia/Tokyo", [])).toEqual(["UTC", "Asia/Tokyo"]);
  });
});
