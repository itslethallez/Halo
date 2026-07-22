import { describe, it, expect } from "vitest";
import { toCsv } from "../csv";

describe("toCsv", () => {
  it("produces a header row and escapes commas/quotes", () => {
    const csv = toCsv([{ name: "Smith, John", note: 'said "hi"' }]);
    expect(csv).toBe('name,note\n"Smith, John","said ""hi"""');
  });

  it("returns an empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });
});
