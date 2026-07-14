import { applyDiscount } from "./price.js";

export function total(items, discountPct) {
  return items.reduce((sum, p) => sum + applyDiscount(p, discountPct), 0);
}
