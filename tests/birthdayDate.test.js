import { describe, expect, it } from "vitest";
import { birthdayEventDate, birthdayInput, nextOccasionDate } from "../src/features/wishlists/birthdayDate.js";

describe("annual birthday dates", () => {
  const today = new Date("2026-11-03T12:00:00Z");
  it.each([["03/11", "2026-11-03"], ["18/01", "2027-01-18"], ["29/02", "2028-02-29"], ["3112", "2026-12-31"], ["", ""], ["31/04", null], ["00/12", null], ["18/", null]])("resolves %s without asking for a year", (value, expected) => {
    expect(birthdayEventDate(value, today)).toBe(expected);
  });
  it("retains an unchanged saved birthday even when its original year is past", () => {
    expect(birthdayInput("2020-02-29")).toBe("29/02");
    expect(birthdayEventDate("29/02", today, "2020-02-29")).toBe("2020-02-29");
  });
  it.each([["2027-02-21", "2027-02-28"], ["2027-02-28", "2027-02-28"], ["2027-03-01", "2028-02-29"], ["2028-02-22", "2028-02-29"]])("observes February 29 annually from %s", (date, expected) => {
    expect(nextOccasionDate("2020-02-29", "birthday", new Date(date + "T12:00:00Z"))).toBe(expected);
  });
  it("does not repeat a one-off wedding", () => {
    expect(nextOccasionDate("2020-01-18", "wedding", today)).toBe("2020-01-18");
  });
});
