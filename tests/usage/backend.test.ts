import { describe, expect, it, vi } from "vitest";
import { fetchBackendUsage, UsageProviderError } from "../../src/usage/providers/backend.js";

const account = { name: "work", home: "/tmp/work", createdAt: "2026-06-04T00:00:00.000Z" };
const auth = { email: "person@example.com", plan: "plus", organization: null, accessToken: "secret", accountId: "acct", lastRefresh: null };

describe("fetchBackendUsage", () => {
  it("fetches and normalizes backend usage without leaking tokens into snapshot", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ email: "person@example.com", plan_type: "plus", rate_limit: { primary_window: { used_percent: 18 } } }), { status: 200 }));
    const snapshot = await fetchBackendUsage(account, auth, { fetchImpl, timeoutMs: 1000 });
    expect(fetchImpl).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer secret", "ChatGPT-Account-Id": "acct" }) }));
    expect(snapshot.usageSource).toBe("backend-api");
    expect(snapshot.fiveHour?.remainingPercent).toBe(82);
    expect(JSON.stringify(snapshot)).not.toContain("secret");
    expect(JSON.stringify(snapshot)).not.toContain("acct");
  });

  it("classifies 401 as token expired", async () => {
    const fetchImpl = vi.fn(async () => new Response("no", { status: 401 }));
    await expect(fetchBackendUsage(account, auth, { fetchImpl, timeoutMs: 1000 })).rejects.toMatchObject({ kind: "token-expired" } satisfies Partial<UsageProviderError>);
  });
});
