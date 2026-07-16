import { describe, it, expect } from "vitest";
import { findPurchase } from "./paddle.mjs";

const PRICE = "pri_test";

const tx = (sub, billedAt, priceId = PRICE, email = "buyer@example.com") => ({
  id: "txn_" + billedAt,
  status: "completed",
  custom_data: sub ? { sub } : null,
  billed_at: new Date(billedAt).toISOString(),
  items: [{ price: { id: priceId } }],
  customer: { email },
});

const fakeFetch = (pages) => async (url) => {
  const after = new URL(url).searchParams.get("after");
  const i = after ? Number(after) : 0;
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: pages[i] ?? [],
      meta: { pagination: { has_more: i + 1 < pages.length, next: `https://api.paddle.com/transactions?after=${i + 1}` } },
    }),
  };
};

describe("findPurchase", () => {
  it("finds a matching purchase and returns its billing time and email", async () => {
    const t = Date.parse("2026-03-01T00:00:00Z");
    const f = fakeFetch([[tx("github:1", t)]]);
    const out = await findPurchase("github:1", { apiKey: "k", priceId: PRICE, fetch: f });
    expect(out).toEqual({ billedAt: t, email: "buyer@example.com" });
  });

  it("returns null when nobody with that sub bought", async () => {
    const f = fakeFetch([[tx("github:2", Date.now())]]);
    expect(await findPurchase("github:1", { apiKey: "k", priceId: PRICE, fetch: f })).toBeNull();
  });

  it("ignores a transaction for a different price", async () => {
    const f = fakeFetch([[tx("github:1", Date.now(), "pri_other")]]);
    expect(await findPurchase("github:1", { apiKey: "k", priceId: PRICE, fetch: f })).toBeNull();
  });

  it("follows pagination", async () => {
    const t = Date.parse("2026-02-01T00:00:00Z");
    const f = fakeFetch([[tx("github:9", Date.now())], [tx("github:1", t)]]);
    const out = await findPurchase("github:1", { apiKey: "k", priceId: PRICE, fetch: f });
    expect(out.billedAt).toBe(t);
  });

  it("tolerates a transaction with no custom_data", async () => {
    const f = fakeFetch([[tx(null, Date.now())]]);
    expect(await findPurchase("github:1", { apiKey: "k", priceId: PRICE, fetch: f })).toBeNull();
  });

  it("throws when Paddle errors", async () => {
    const f = async () => ({ ok: false, status: 500, json: async () => ({}) });
    await expect(findPurchase("github:1", { apiKey: "k", priceId: PRICE, fetch: f })).rejects.toThrow("paddle_500");
  });
});
