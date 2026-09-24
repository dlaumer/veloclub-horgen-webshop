import { CartItem } from "@/types/shop";
import { normalizeReturnCategory } from "@/lib/returnDiscount";

export type PromoCodeType = "return_category" | "percentage" | "free_order";

export type ResolvedPromo = { code: string; type: PromoCodeType; percentage: number } | null;

export type PricedCartItem = CartItem & {
  discountCents: number;
  isReturn: boolean;
  lineTotalCents: number;
  lineTotal: number; // CHF
};

export type CartPricing = {
  lines: PricedCartItem[];
  subtotalCents: number;
  totalCents: number;
  subtotal: number;
  total: number;
  discountCents: number;
  discount: number;
};

function toCents(chf: number) {
  return Math.round(Number(chf || 0) * 100);
}

// Preview-only mirror of backend/pb_hooks/lib_zahls.js's computeCartPricing
// (same cents arithmetic, same per-line percentage rounding) so the cart
// preview shown here never drifts from what the server actually charges.
// The server always recomputes this from scratch and is the sole source of
// truth - nothing computed here is ever trusted by the backend.
export function computeCartPricing(items: CartItem[], promo: ResolvedPromo): CartPricing {
  const base = items.map((it) => ({
    ...it,
    qty: Math.max(0, Number(it.quantity || 0)),
    unitFull: Math.max(0, toCents(it.price)),
    returnCategory: normalizeReturnCategory(it.returnCategory) || "no",
  }));

  const perLineDiscount = base.map(() => 0);
  if (promo && promo.type === "return_category") {
    const cheapestIndexByCategory = new Map<string, number>();
    base.forEach((it, idx) => {
      const cat = it.returnCategory;
      if (cat === "no" || it.qty <= 0) return;
      const curIdx = cheapestIndexByCategory.get(cat);
      if (curIdx == null || it.unitFull < base[curIdx].unitFull) cheapestIndexByCategory.set(cat, idx);
    });
    cheapestIndexByCategory.forEach((idx) => {
      perLineDiscount[idx] = base[idx].unitFull;
    });
  }

  const lines: PricedCartItem[] = base.map((it, idx) => {
    const discount = Math.min(perLineDiscount[idx], it.unitFull);
    const lineTotalCents =
      it.qty > 0 ? Math.max(0, it.unitFull - discount) + Math.max(0, it.qty - 1) * it.unitFull : 0;
    return {
      ...it,
      discountCents: it.qty > 0 ? discount : 0,
      isReturn: discount > 0,
      lineTotalCents,
      lineTotal: lineTotalCents / 100,
    };
  });

  const subtotalCents = base.reduce((s, it) => s + it.unitFull * it.qty, 0);

  if (promo && promo.type === "percentage") {
    const pct = Math.min(100, Math.max(0, promo.percentage || 0));
    lines.forEach((l) => {
      const reduced = Math.round((l.lineTotalCents * (100 - pct)) / 100);
      l.discountCents += l.lineTotalCents - reduced;
      l.lineTotalCents = reduced;
      l.lineTotal = reduced / 100;
    });
  } else if (promo && promo.type === "free_order") {
    lines.forEach((l) => {
      l.discountCents += l.lineTotalCents;
      l.lineTotalCents = 0;
      l.lineTotal = 0;
    });
  }

  const totalCents = lines.reduce((s, l) => s + l.lineTotalCents, 0);
  const discountCents = subtotalCents - totalCents;

  return {
    lines,
    subtotalCents,
    totalCents,
    subtotal: subtotalCents / 100,
    total: totalCents / 100,
    discountCents,
    discount: discountCents / 100,
  };
}
