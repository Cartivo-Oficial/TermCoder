import { verifySession } from "./session.mjs";
import { signLicenseKey } from "./license.mjs";
import { findPurchase as realFindPurchase } from "./paddle.mjs";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export async function issueLicense(body, env, deps = {}) {
  const find = deps.findPurchase ?? realFindPurchase;

  if (!env.SESSION_SECRET || !env.PADDLE_API_KEY || !env.PADDLE_PRICE_ID || !env.PRO_PRIVATE_KEY) {
    return { status: 503, body: { error: "not_configured" } };
  }

  const claims = await verifySession(body?.session ?? "", env.SESSION_SECRET);
  if (!claims) return { status: 401, body: { error: "bad_session" } };

  let purchase;
  try {
    purchase = await find(claims.sub, { apiKey: env.PADDLE_API_KEY, priceId: env.PADDLE_PRICE_ID });
  } catch {
    return { status: 502, body: { error: "paddle_unreachable" } };
  }
  if (!purchase) return { status: 200, body: { active: false, reason: "no-purchase" } };

  const sessionEmail = (claims.email ?? "").trim();
  const purchaseEmail = (purchase.email ?? "").trim();
  const email = sessionEmail || purchaseEmail;
  if (!email) return { status: 200, body: { active: false, reason: "no-email" } };

  const issued = purchase.billedAt;
  const expires = issued + YEAR_MS;
  let key;
  try {
    key = await signLicenseKey({ email, name: claims.name, issued, expires }, env.PRO_PRIVATE_KEY);
  } catch {
    return { status: 503, body: { error: "not_configured" } };
  }
  return { status: 200, body: { active: true, key, email, issued, expires } };
}
