import { describe, expect, it } from "vitest";
import { maskEmail } from "../../src/utils/mask.js";

describe("maskEmail", () => {
  it("masks local part while preserving domain", () => {
    expect(maskEmail("sijun@example.com")).toBe("sij***@example.com");
    expect(maskEmail("ab@example.com")).toBe("a***@example.com");
  });

  it("returns placeholder for missing or invalid email", () => {
    expect(maskEmail(undefined)).toBe("-");
    expect(maskEmail("not-email")).toBe("not-email");
  });
});
