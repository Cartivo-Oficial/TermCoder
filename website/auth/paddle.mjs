const MAX_PAGES = 5;
const API = "https://api.paddle.com/transactions?status=completed&per_page=200&order_by=billed_at[DESC]&include=customer";

export async function findPurchase(sub, opts) {
  const doFetch = opts.fetch ?? fetch;
  let url = API;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await doFetch(url, {
      headers: { authorization: "Bearer " + opts.apiKey, accept: "application/json" },
    });
    if (!res.ok) throw new Error("paddle_" + res.status);
    const body = await res.json();

    for (const t of body.data ?? []) {
      if (t.custom_data?.sub !== sub) continue;
      const priced = (t.items ?? []).some((i) => i.price?.id === opts.priceId);
      if (!priced) continue;
      const billedAt = Date.parse(t.billed_at);
      if (Number.isNaN(billedAt)) throw new Error("paddle_bad_billed_at");
      return {
        billedAt,
        email: t.customer?.email ?? "",
      };
    }

    const pag = body.meta?.pagination;
    if (!pag?.has_more || !pag.next) return null;
    url = pag.next;
  }
  return null;
}
