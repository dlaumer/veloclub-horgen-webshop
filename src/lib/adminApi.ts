// src/lib/adminApi.ts
//
// Thin fetch-based client for the admin dashboard (/admin). Talks directly
// to PocketBase's built-in REST API using a token from the "admins" auth
// collection (see backend/pb_migrations/1783900000_create_admins_collection.js
// and 1783900200_orders_admin_read_rules.js). No PocketBase SDK dependency -
// same plain-fetch style as stockApi.ts.

const API_BASE = import.meta.env.VITE_API_BASE || "";

const STORAGE_KEY = "vch_admin_auth";

// Set in sessionStorage right before we force a logout due to an expired/
// invalid session, so the login page can show "you were logged out"
// instead of a bare empty form. Cleared once AdminLogin reads it.
const SESSION_EXPIRED_FLAG = "vch_admin_session_expired";

// Dispatched on `window` whenever we detect the stored session is no longer
// valid (expired token found on load, or a 401/403 from the API). AdminAuthContext
// listens for this to clear its React state, which in turn makes
// RequireAdminAuth redirect to /admin/login - see that file for the actual
// redirect logic, this module only detects + announces the problem.
export const AUTH_EXPIRED_EVENT = "vch-admin-auth-expired";

export class AuthExpiredError extends Error {
  constructor() {
    super("Session expired");
    this.name = "AuthExpiredError";
  }
}

export type AdminRecord = {
  id: string;
  email: string;
  name?: string;
};

export type AdminAuth = {
  token: string;
  record: AdminRecord;
};

/** Decodes a JWT's `exp` claim (seconds since epoch) without verifying the
 * signature - we're only using this client-side to avoid presenting an
 * obviously-expired token to the server, the server still enforces the
 * real check. Returns null if the token isn't a well-formed JWT or has no
 * `exp` claim (treated as "can't tell, assume valid" by the caller). */
function decodeJwtExp(token: string): number | null {
  try {
    const payloadB64 = token.split(".")[1];
    if (!payloadB64) return null;
    const json = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const exp = decodeJwtExp(token);
  if (exp == null) return false;
  return Date.now() >= exp * 1000;
}

function markSessionExpired() {
  try {
    sessionStorage.setItem(SESSION_EXPIRED_FLAG, "1");
  } catch {
    /* ignore - sessionStorage unavailable (e.g. private mode edge cases) */
  }
}

/** AdminLogin calls this once on mount to know whether to show a "you were
 * logged out" notice, then it's cleared so a normal future logout doesn't
 * show a stale message. */
export function consumeSessionExpiredFlag(): boolean {
  try {
    const was = sessionStorage.getItem(SESSION_EXPIRED_FLAG) === "1";
    sessionStorage.removeItem(SESSION_EXPIRED_FLAG);
    return was;
  } catch {
    return false;
  }
}

export function loadStoredAdminAuth(): AdminAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.record) return null;
    if (isTokenExpired(parsed.token)) {
      // don't even try using it - avoid a round trip that we already know
      // will fail, and avoid briefly rendering the dashboard shell first.
      localStorage.removeItem(STORAGE_KEY);
      markSessionExpired();
      return null;
    }
    return parsed as AdminAuth;
  } catch {
    return null;
  }
}

export function storeAdminAuth(auth: AdminAuth | null) {
  if (!auth) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

/**
 * Log in against the "admins" auth collection. Throws with a readable
 * message on invalid credentials / network failure.
 */
export async function adminLogin(email: string, password: string): Promise<AdminAuth> {
  const res = await fetch(`${API_BASE}/api/collections/admins/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: email, password }),
  });

  if (!res.ok) {
    if (res.status === 400) throw new Error("Invalid email or password");
    throw new Error(`Login failed (${res.status})`);
  }

  const json = await res.json();
  const auth: AdminAuth = {
    token: json.token,
    record: { id: json.record.id, email: json.record.email, name: json.record.name },
  };
  return auth;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: token };
}

async function pbFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(token), ...(init?.headers || {}) },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    // Invalid/expired token, or the admins record itself is gone - either
    // way this session can't be trusted anymore. Clear it and tell the rest
    // of the app (AdminAuthContext) so it can bounce to the login screen,
    // instead of every query silently resolving to an empty list.
    storeAdminAuth(null);
    markSessionExpired();
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    throw new AuthExpiredError();
  }

  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.message ? `: ${j.message}` : "";
    } catch {
      /* ignore */
    }
    throw new Error(`Request failed (${res.status})${detail}`);
  }
  // DELETE (and some other) responses come back with an empty body (204 or
  // just no content) - res.json() would throw on that, so only parse when
  // there's actually something to parse.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// PocketBase bool fields normally default to `false`, but rows created by
// the legacy Excel import can leave these unset - treat as "unknown", not
// "false", so the dashboard can show N/A instead of a misleading "No".
export type FlagValue = boolean | null | undefined;

// `ready` and `picked_up` are NOT real bool fields - PocketBase can't
// represent "unknown" on a bool, so they were migrated to tri-state TEXT
// fields instead (see backend/pb_migrations/1783900500_orders_ready_pickup_tristate.js
// and the matching hooks in backend/pb_hooks/veloclub.pb.js). Going forward
// the hooks/dashboard write "yes" / "no", but older rows (imported straight
// from the legacy Excel sheet, or edited by hand in the PocketBase admin
// UI) can hold other spellings like "True" / "False" / "N/A" / "" - use
// `parseTriState` below rather than comparing directly.
export type TriStateRaw = string | boolean | null | undefined;

/**
 * Normalizes a `ready` / `picked_up` (or any other tri-state flag) value
 * into a real true / false / null ("unknown"), tolerant of the various
 * spellings that can show up in the text field ("yes", "true", "True",
 * "1", "no", "false", "False", "0", "", "N/A", legacy real booleans, ...).
 */
export function parseTriState(v: TriStateRaw): boolean | null {
  if (typeof v === "boolean") return v;
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (s === "yes" || s === "true" || s === "1") return true;
  if (s === "no" || s === "false" || s === "0") return false;
  return null;
}

export type OrderRecord = {
  id: string;
  order_number: string;
  buyer_name: string;
  buyer_lastname: string;
  buyer_email: string;
  kidzbike: FlagValue;
  comments: string;
  payment_provider: string;
  payment_status: string;
  amount_paid: number;
  currency: string;
  cancelled: FlagValue;
  cancelled_at: string;
  cancelled_note: string;
  ready: TriStateRaw;
  picked_up: TriStateRaw;
  internal_note: string;
  placed_at: string;
  created: string;
  // The real fee Zahls/Payrexx charged for this transaction, in CHF - from
  // the payment webhook (tx.fee, see 1783909000_orders_provider_fee.js).
  // 0 for orders placed before this field existed, and for free/promo
  // orders (which never had a fee taken in the first place) - see
  // estimateProviderFee/computeMoneyReceived below for how the UI tells
  // those two "0" cases apart.
  provider_fee: number;
};

// Zahls/Payrexx charges CHF 0.30 + 2.9% per transaction - this is also
// exactly the estimate calcPriceFromCost (ArticleModal.tsx) bakes into the
// selling price. Confirmed against a real webhook payload: CHF 78.00 ->
// CHF 2.56 fee actually taken, and 78 * 0.029 + 0.30 = 2.562, matching to
// the cent. Used as a fallback for orders placed before orders.provider_fee
// existed (which is 0 for those, same as a genuinely fee-free order) - real
// orders always prefer the actual provider_fee once available.
const PAYMENT_FIXED_FEE = 0.3;
const PAYMENT_PERCENT_FEE = 0.029;

export function estimateProviderFee(amountPaid: number): number {
  if (!amountPaid) return 0;
  return amountPaid * PAYMENT_PERCENT_FEE + PAYMENT_FIXED_FEE;
}

/** What the club actually kept after Zahls/Payrexx's cut - amount_paid
 * minus the real fee (order.provider_fee) when we have one, otherwise the
 * 2.9% + CHF 0.30 estimate. Orders with no real payment (free/promo,
 * payment_provider !== "zahls") never had a fee taken at all. */
export function computeMoneyReceived(
  order: Pick<OrderRecord, "payment_provider" | "amount_paid" | "provider_fee">,
): number {
  if (order.payment_provider !== "zahls" || !order.amount_paid) return order.amount_paid || 0;
  const fee = order.provider_fee > 0 ? order.provider_fee : estimateProviderFee(order.amount_paid);
  return order.amount_paid - fee;
}

export type OrderItemRecord = {
  id: string;
  order: string;
  article: string;
  size: string;
  color: string;
  quantity: number;
  unit_price: number;
  price_paid: number;
  is_return: boolean;
  expand?: {
    article?: {
      id: string;
      article_number: string;
      name: string;
      color_name: string;
      images?: string[];
      cost_price: number;
    };
  };
};

export type LogRecord = {
  id: string;
  order: string;
  kind: "purchase" | "ready" | "pickup" | "cancel" | "ready_undo" | "pickup_undo";
  note: string;
  created: string;
  // The log's own "this actually happened at" timestamp - NOT the same as
  // the order's placed_at. For "purchase" logs this is set to match the
  // order's placed_at (same moment, by definition). For "ready"/"pickup"/
  // "cancel" logs it's set to the moment staff toggled that flag, which can
  // be long after the order was originally placed.
  placed_at: string;
  // Which admin (name, falling back to email) performed this action - only
  // set for "ready"/"pickup"/"cancel" logs written from an authenticated
  // dashboard request. Blank for "purchase" logs (written by the Zahls
  // payment webhook, which has no admin involved).
  admin_name?: string;
};

/** Fetches all orders, newest first. PocketBase caps perPage at 500. */
export async function listOrders(token: string): Promise<OrderRecord[]> {
  const json = await pbFetch<{ items: OrderRecord[] }>(
    `/api/collections/orders/records?sort=-placed_at&perPage=500`,
    token,
  );
  return json.items;
}

export async function listOrderItems(token: string): Promise<OrderItemRecord[]> {
  const json = await pbFetch<{ items: OrderItemRecord[] }>(
    `/api/collections/order_items/records?perPage=500&expand=article`,
    token,
  );
  return json.items;
}

export async function listLogs(token: string): Promise<LogRecord[]> {
  const json = await pbFetch<{ items: LogRecord[] }>(
    `/api/collections/logs/records?sort=-created&perPage=500`,
    token,
  );
  return json.items;
}

export async function updateOrder(
  token: string,
  id: string,
  patch: Partial<Pick<OrderRecord, "ready" | "picked_up" | "internal_note">>,
): Promise<OrderRecord> {
  return pbFetch<OrderRecord>(`/api/collections/orders/records/${id}`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

/**
 * Cancels an order and, if it was actually paid via Zahls, refunds it
 * through the Zahls API first - NOT a plain PATCH to the orders collection
 * (the backend's onRecordUpdateRequest hook rejects a direct {cancelled:
 * true} PATCH specifically to force this through the refund-aware custom
 * route instead, see backend/pb_hooks/admin.pb.js). A failed refund throws
 * here (via pbFetch's non-2xx handling) with the backend's specific error
 * message, and the order is never marked cancelled in that case.
 *
 * refundAmount is CHF, optional - defaults to the order's full amount_paid
 * server-side if omitted. Orders with no real Zahls payment (legacy Excel
 * imports, free/promo orders) are cancelled with nothing refunded,
 * regardless of what's passed here.
 */
export async function cancelOrder(
  token: string,
  id: string,
  data: { note: string; refundAmount?: number },
): Promise<{ ok: boolean; order: OrderRecord; refunded: number }> {
  return pbFetch(`/api/admin/orders/${id}/cancel`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}


// ---------------------------------------------------------------------
// Article editing. The read-only Articles panel is built from the public
// /api/stock endpoint (same one the storefront uses), which deliberately
// omits internal-only fields (cost_price, notes) and doesn't carry real
// PocketBase record ids - fine for display, but not enough to edit. So
// editing fetches the raw "articles"/"article_items" records directly
// (allowed - articles/article_items listRule is public, and
// createRule/updateRule/deleteRule were opened to "admins" tokens in
// backend/pb_migrations/1783900100_articles_admin_write_rules.js) and
// writes back to those same raw collections.
// ---------------------------------------------------------------------

export type ArticleRecord = {
  id: string;
  article_number: string;
  product_id: string;
  name: string;
  price: number;
  cost_price: number;
  main_category: string;
  category: string;
  color_name: string;
  color_code: string;
  images: string[]; // ordered filenames - see articleFileUrl()
  embed_3d: string;
  just_stock: string;
  return_category: string;
  description: string;
  notes: string;
  sort_order: number;
};

/** Full public URL for an uploaded article image filename (as found in
 * ArticleRecord.images / expand.article.images). */
export function articleFileUrl(articleId: string, filename: string): string {
  return `${API_BASE}/api/files/articles/${articleId}/${filename}`;
}

export type ArticleItemRecord = {
  id: string;
  article: string;
  size: string;
  stock: number;
  // Display order among an article's sizes - staff-controlled (drag/arrows
  // in ArticleModal's size editor), NOT alphabetical (see
  // 1783907000_article_items_sort_order.js for why: "L" < "M" < "S" sorts
  // wrong for clothing sizes).
  sort_order: number;
};

/** Looks up the raw articles record behind a storefront sku (article_number). */
export async function findArticleByNumber(token: string, articleNumber: string): Promise<ArticleRecord | null> {
  const filter = encodeURIComponent(`article_number = "${articleNumber}"`);
  const json = await pbFetch<{ items: ArticleRecord[] }>(
    `/api/collections/articles/records?filter=${filter}&perPage=1`,
    token,
  );
  return json.items[0] || null;
}

export async function listArticleItemsForArticle(token: string, articleId: string): Promise<ArticleItemRecord[]> {
  const filter = encodeURIComponent(`article = "${articleId}"`);
  const json = await pbFetch<{ items: ArticleItemRecord[] }>(
    `/api/collections/article_items/records?filter=${filter}&perPage=200&sort=sort_order`,
    token,
  );
  return json.items;
}

export async function updateArticle(
  token: string,
  id: string,
  patch: Partial<Omit<ArticleRecord, "id" | "article_number">>,
): Promise<ArticleRecord> {
  return pbFetch<ArticleRecord>(`/api/collections/articles/records/${id}`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

/**
 * Deletes an article. article_items.article has cascadeDelete:true (see
 * pb_migrations/1783878030_split_article_stock_items.js), so PocketBase
 * removes the article's size/stock rows automatically in the same request -
 * no separate article_items cleanup needed here.
 *
 * order_items.article is the opposite: required + cascadeDelete:false (see
 * pb_migrations/1752313200_create_veloclub_collections.js), on purpose - it
 * protects historical order data by making PocketBase refuse to delete an
 * article that's still referenced by any order_item. That refusal surfaces
 * here as a normal thrown Error from pbFetch (non-2xx response); the caller
 * should show that as "this article has order history" rather than a
 * generic failure.
 */
export async function deleteArticle(token: string, id: string): Promise<void> {
  await pbFetch<unknown>(`/api/collections/articles/records/${id}`, token, { method: "DELETE" });
}

/**
 * Raw articles list (every color-variant record, real PocketBase id
 * included) sorted by sort_order - used only by the product-reorder
 * feature in AdminDashboard/ArticlesPanel, which needs the actual record
 * ids to PATCH (unlike EnrichedArticle, which is built from the public
 * /api/stock shape and only carries the storefront sku as "id").
 */
export async function listAllArticles(token: string): Promise<ArticleRecord[]> {
  const json = await pbFetch<{ items: ArticleRecord[] }>(
    `/api/collections/articles/records?sort=sort_order&perPage=500`,
    token,
  );
  return json.items;
}

/**
 * Applies a batch of sort_order changes (one PATCH per changed record).
 * Used by the product up/down reorder controls - see the big comment on
 * "reorderMode" in AdminDashboard.tsx for why this always renumbers the
 * whole visible product list rather than shuffling single values: it's
 * what self-heals any pre-existing duplicate/gap sort_order values instead
 * of just working around them.
 */
export async function setArticleSortOrders(
  token: string,
  updates: Array<{ id: string; sort_order: number }>,
): Promise<void> {
  await Promise.all(updates.map((u) => updateArticle(token, u.id, { sort_order: u.sort_order })));
}

/**
 * Adds newFiles to an article's images while preserving the ones already
 * there. IMPORTANT: PocketBase sets a file field to exactly what's
 * submitted in a single multipart request - it does NOT accumulate
 * uploads across separate requests (confirmed the hard way: a migration
 * script that PATCHed one new file at a time ended up with only the last
 * file each time, see backend/scripts/migrate_images_to_files.mjs). So
 * this resends every existing filename (as a plain string part, which
 * PocketBase resolves against the file already stored under that name -
 * it does not re-upload those bytes) alongside the new File blobs, all in
 * one request, in the desired final order.
 */
export async function addArticleImages(
  token: string,
  articleId: string,
  existingFilenames: string[],
  newFiles: File[],
): Promise<ArticleRecord> {
  const form = new FormData();
  for (const fn of existingFilenames) form.append("images", fn);
  for (const f of newFiles) form.append("images", f, f.name);
  return pbFetch<ArticleRecord>(`/api/collections/articles/records/${articleId}`, token, {
    method: "PATCH",
    // no Content-Type header - the browser computes the multipart
    // boundary itself from the FormData body.
    body: form,
  });
}

/** Reorders (or removes) images by resending the exact desired final list
 * of already-uploaded filenames - no file bytes involved, so this is just
 * a normal JSON field update like any other article field. */
export async function setArticleImageOrder(
  token: string,
  articleId: string,
  filenames: string[],
): Promise<ArticleRecord> {
  return updateArticle(token, articleId, { images: filenames });
}

export async function updateArticleItem(
  token: string,
  id: string,
  patch: Partial<Pick<ArticleItemRecord, "size" | "stock" | "sort_order">>,
): Promise<ArticleItemRecord> {
  return pbFetch<ArticleItemRecord>(`/api/collections/article_items/records/${id}`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function createArticleItem(
  token: string,
  data: { article: string; size: string; stock: number; sort_order?: number },
): Promise<ArticleItemRecord> {
  return pbFetch<ArticleItemRecord>(`/api/collections/article_items/records`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteArticleItem(token: string, id: string): Promise<void> {
  await pbFetch<unknown>(`/api/collections/article_items/records/${id}`, token, { method: "DELETE" });
}

// ---------------------------------------------------------------------
// Promo codes. Plain REST CRUD against the "promo_codes" collection -
// no custom backend route needed (unlike orders' cancel flow), since
// there's no side effect beyond the record itself: list/view/create/
// update/delete are all opened to "admins" tokens directly (see
// pb_migrations/1783907000_create_promo_codes.js). Checkout itself never
// calls this API - it resolves codes server-side via lib_zahls.js's
// resolvePromoCode, which bypasses these REST rules entirely.
// ---------------------------------------------------------------------

export type PromoCodeType = "return_category" | "percentage" | "free_order";

export type PromoCodeRecord = {
  id: string;
  code: string;
  type: PromoCodeType;
  percentage: number;
  active: boolean;
  created: string;
  updated: string;
};

export async function listPromoCodes(token: string): Promise<PromoCodeRecord[]> {
  const json = await pbFetch<{ items: PromoCodeRecord[] }>(
    `/api/collections/promo_codes/records?sort=-created&perPage=200`,
    token,
  );
  return json.items;
}

export async function createPromoCode(
  token: string,
  data: { code: string; type: PromoCodeType; percentage?: number; active: boolean },
): Promise<PromoCodeRecord> {
  return pbFetch<PromoCodeRecord>(`/api/collections/promo_codes/records`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updatePromoCode(
  token: string,
  id: string,
  patch: Partial<Pick<PromoCodeRecord, "code" | "type" | "percentage" | "active">>,
): Promise<PromoCodeRecord> {
  return pbFetch<PromoCodeRecord>(`/api/collections/promo_codes/records/${id}`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function deletePromoCode(token: string, id: string): Promise<void> {
  await pbFetch<unknown>(`/api/collections/promo_codes/records/${id}`, token, { method: "DELETE" });
}
