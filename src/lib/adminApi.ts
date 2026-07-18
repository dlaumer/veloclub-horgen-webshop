// src/lib/adminApi.ts
//
// Thin fetch-based client for the admin dashboard (/admin). Talks directly
// to PocketBase's built-in REST API using a token from the "admins" auth
// collection (see backend/pb_migrations/1783900000_create_admins_collection.js
// and 1783900200_orders_admin_read_rules.js). No PocketBase SDK dependency -
// same plain-fetch style as stockApi.ts.

const API_BASE = import.meta.env.VITE_API_BASE || "";

const STORAGE_KEY = "vch_admin_auth";

export type AdminRecord = {
  id: string;
  email: string;
  name?: string;
};

export type AdminAuth = {
  token: string;
  record: AdminRecord;
};

export function loadStoredAdminAuth(): AdminAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.record) return null;
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
  return res.json();
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
};

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
      image_urls?: string[];
    };
  };
};

export type LogRecord = {
  id: string;
  order: string;
  kind: "purchase" | "ready" | "pickup" | "cancel";
  note: string;
  created: string;
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
  patch: Partial<Pick<OrderRecord, "ready" | "picked_up" | "cancelled" | "cancelled_note" | "internal_note">>,
): Promise<OrderRecord> {
  return pbFetch<OrderRecord>(`/api/collections/orders/records/${id}`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}
