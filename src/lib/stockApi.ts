// src/lib/stockApi.ts

export type SizeKey =
  | 'XXS' | 'XS' | 'S' | 'M' | 'L' | 'XL'
  | 'XXL' | '3XL' | '4XL' | '5XL';

export type Product = {
  sku: string;
  name: string;
  price: number;
  sizes: Record<SizeKey, number>;
  totalStock: number;
  imageUrl?: string;
};

type StockResponse =
  | { ok: true; data: Product[] }
  | { ok: false; error: string };

type SkuResponse =
  | { ok: true; data: Product }
  | { ok: false; error: string };

export type PurchaseItem = {
  sku: string;
  size: SizeKey;
  qty: number;
};

// Base URL of your Cloudflare Worker (safe to expose in frontend)
const API_BASE =
  import.meta.env.VITE_API_BASE ??
  'https://veloclub-gas-proxy.daniel-laumer.workers.dev';

/**
 * Fetch all products with their stock
 */
export async function fetchStock(): Promise<Product[]> {
  const url = `${API_BASE}/api/stock`;
  const res = await fetch(url, { cache: 'no-store' });
  console.log(res.body)
  if (!res.ok) throw new Error(`Stock fetch failed: ${res.status}`);
  const json: StockResponse = await res.json();
  console.log(json)

  if (!json.ok) throw new Error((json as { ok: false; error: string }).error);
  return (json as { ok: true; data: Product[] }).data;
}

/**
 * Fetch one product by SKU
 */
export async function fetchSku(sku: string): Promise<Product> {
  const url = `${API_BASE}/api/stock?sku=${encodeURIComponent(sku)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`SKU fetch failed: ${res.status}`);
  const json: SkuResponse = await res.json();
  if (!json.ok) throw new Error((json as { ok: false; error: string }).error);
  return (json as { ok: true; data: Product }).data;
}

/**
 * Confirm a purchase (after payment). Backend ensures stock is decremented
 * safely using Apps Script + GAS_TOKEN.
 */
export async function confirmPurchase(
  items: PurchaseItem[],
  orderId: string // unique idempotency key
) {
  const res = await fetch(`${API_BASE}/api/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, idempotencyKey: orderId }),
  });
  if (!res.ok) throw new Error(`Purchase failed: ${res.status}`);
  return res.json(); // will return { ok:true, data:[...] } from Apps Script
}
