import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fetchResetCredits, formatResetCredits, readResetCreditAuth, ResetCreditError } from "../../src/reset-credits/provider.js";

describe("reset credit provider", () => {
  it("reads only the auth fields required for reset credit checks", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "cxs-reset-credit-auth-"));
    await writeFile(path.join(home, "auth.json"), JSON.stringify({
      tokens: { access_token: "SECRET", account_id: "acct_123" },
      profile: { email: "person@example.com" },
    }));

    await expect(readResetCreditAuth(home)).resolves.toEqual({ accessToken: "SECRET", accountId: "acct_123" });
  });

  it("calls only the reset credit endpoint and does not put secrets in the formatted summary", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      available_reset_credits: 2,
      total_earned_count: "3",
      reset_credits: [
        { id: "credit_secret", expires_at: "2026-06-04T10:30:00Z", account_id: "acct_123" },
      ],
    }), { status: 200 }));

    const data = await fetchResetCredits({ accessToken: "SECRET", accountId: "acct_123" }, { fetchImpl, timeoutMs: 1000 });
    const output = formatResetCredits(data, { timezone: "UTC" });

    expect(fetchImpl).toHaveBeenCalledWith("https://chatgpt.com/backend-api/wham/rate-limit-reset-credits", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer SECRET", "OpenAI-Account": "acct_123" }),
    }));
    expect(output).toContain("Available reset credits: 2");
    expect(output).toContain("Total earned count: 3");
    expect(output).toContain("Credit 1 expires: 4 June 2026, 10:30 AM");
    expect(output).not.toContain("SECRET");
    expect(output).not.toContain("acct_123");
    expect(output).not.toContain("credit_secret");
  });

  it("summarizes missing counts and empty expiry lists without raw payload details", () => {
    expect(formatResetCredits({ something_else: true })).toBe([
      "Available reset credits: unknown",
      "Total earned count: unknown",
      "No reset credit expiries found.",
    ].join("\n"));
  });

  it("reports HTTP failures as short errors", async () => {
    const fetchImpl = vi.fn(async () => new Response("no", { status: 401 }));
    await expect(fetchResetCredits({ accessToken: "SECRET", accountId: "acct_123" }, { fetchImpl, timeoutMs: 1000 })).rejects.toMatchObject({
      message: "Endpoint returned HTTP 401.",
    } satisfies Partial<ResetCreditError>);
  });

  it("rejects missing auth without exposing file contents", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "cxs-reset-credit-missing-auth-"));
    await mkdir(path.join(home, "nested"), { recursive: true });
    await expect(readResetCreditAuth(home)).rejects.toThrow("Codex auth file was not found.");
  });
});
