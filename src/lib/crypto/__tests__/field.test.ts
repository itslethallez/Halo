import { describe, it, expect, beforeAll } from "vitest";
import { decryptField, encryptField } from "../field";
import { hashPassword, verifyPassword } from "../password";

beforeAll(() => {
  process.env.FIELD_ENCRYPTION_KEY = "0".repeat(64);
});

describe("field encryption", () => {
  it("round-trips a plaintext value", () => {
    const encrypted = encryptField("123 Example St, Bondi NSW 2026");
    expect(encrypted).not.toContain("Example St");
    expect(decryptField(encrypted)).toBe("123 Example St, Bondi NSW 2026");
  });

  it("produces different ciphertext for the same plaintext each time (random IV)", () => {
    const a = encryptField("distress phrase: pineapple");
    const b = encryptField("distress phrase: pineapple");
    expect(a).not.toBe(b);
  });

  it("throws on a tampered payload", () => {
    const encrypted = encryptField("sensitive value");
    const tampered = encrypted.slice(0, -2) + "00";
    expect(() => decryptField(tampered)).toThrow();
  });
});

describe("password hashing", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
  });
});
