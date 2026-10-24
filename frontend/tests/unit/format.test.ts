import { describe, expect, it } from "vitest";
import { formatTimestamp } from "@/lib/format";
describe("deterministic Eastern quote timestamps", () => {
  it("uses explicit punctuation shared by server and browser", () => {
    expect(formatTimestamp("2026-10-24T02:09:00Z")).toBe(
      "Oct 23, 2026, 10:09 PM EDT",
    );
  });
  it("converts both sides of the daylight-saving transition", () => {
    expect(formatTimestamp("2026-03-08T06:00:00Z")).toBe(
      "Mar 8, 2026, 1:00 AM EST",
    );
    expect(formatTimestamp("2026-03-08T07:00:00Z")).toBe(
      "Mar 8, 2026, 3:00 AM EDT",
    );
  });
});
