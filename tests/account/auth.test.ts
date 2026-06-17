import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { decodeJwtPayload, readAuthSummary } from "../../src/account/auth.js";

function jwt(payload: object): string {
  return ["header", Buffer.from(JSON.stringify(payload)).toString("base64url"), "sig"].join(".");
}

describe("readAuthSummary", () => {
  it("extracts access token, account id, email, plan, organization, and last refresh from auth.json", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "cxs-auth-"));
    await writeFile(path.join(home, "auth.json"), JSON.stringify({
      last_refresh: "2026-06-04T10:00:00.000Z",
      tokens: {
        id_token: jwt({
          email: "person@example.com",
          "https://api.openai.com/auth": {
            chatgpt_plan_type: "plus",
            organizations: [{ title: "Org A", is_default: true }],
          },
        }),
        access_token: "access-secret",
        account_id: "acct_123",
      },
    }));

    expect(await readAuthSummary(home)).toEqual({
      email: "person@example.com",
      plan: "plus",
      organization: "Org A",
      accountId: "acct_123",
      accessToken: "access-secret",
      lastRefresh: "2026-06-04T10:00:00.000Z",
    });
  });

  it("returns null JWT-derived fields when JWT payload decode fails", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "cxs-auth-bad-"));
    await writeFile(path.join(home, "auth.json"), JSON.stringify({ tokens: { id_token: "not-a-jwt", access_token: "access", account_id: "acct" } }));

    const summary = await readAuthSummary(home);
    expect(summary?.email).toBeNull();
    expect(summary?.plan).toBeNull();
    expect(summary?.organization).toBeNull();
    expect(summary?.accessToken).toBe("access");
    expect(summary?.accountId).toBe("acct");
    expect(decodeJwtPayload("not-a-jwt")).toBeNull();
  });
});
