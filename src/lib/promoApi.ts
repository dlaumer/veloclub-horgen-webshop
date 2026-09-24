import { PromoCodeType } from "@/lib/promoPricing";

const API_BASE = import.meta.env.VITE_API_BASE || "";

export type PromoValidation =
  | { valid: true; type: PromoCodeType; percentage: number }
  | { valid: false };

// Public, unauthenticated lookup - see GET /api/promo-code in
// backend/pb_hooks/veloclub.pb.js. Only ever reveals whether a code is
// active and, if so, its type/percentage - never the full promo_codes list.
// This is purely for the live preview in the cart; checkout itself always
// re-resolves the code server-side too (see lib_zahls.js's resolvePromoCode).
export async function validatePromoCode(code: string): Promise<PromoValidation> {
  const trimmed = code.trim();
  if (!trimmed) return { valid: false };
  try {
    const res = await fetch(`${API_BASE}/api/promo-code?code=${encodeURIComponent(trimmed)}`);
    if (!res.ok) return { valid: false };
    const json = await res.json();
    if (!json || json.valid !== true) return { valid: false };
    return { valid: true, type: json.type, percentage: Number(json.percentage || 0) };
  } catch {
    return { valid: false };
  }
}
