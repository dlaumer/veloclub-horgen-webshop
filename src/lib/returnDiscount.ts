// Only the return-category normalization helper lives here now - the
// actual per-promo-type pricing (return_category / percentage / free_order)
// moved to src/lib/promoPricing.ts, which mirrors the server-authoritative
// computeCartPricing in backend/pb_hooks/lib_zahls.js. This file used to
// also contain calculateReturnPromoDiscounts/calculateCartTotals, a
// return_category-only, purely client-trusted calculation - removed now
// that checkout no longer trusts any client-computed discount.

const NO_RETURN_CATEGORY = "no";

export function normalizeReturnCategory(category?: string | null) {
  const normalized = String(category || "").trim().toLowerCase();
  return normalized && normalized !== NO_RETURN_CATEGORY ? normalized : "";
}
