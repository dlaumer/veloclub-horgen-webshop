// worker.ts — Cloudflare Worker (TypeScript) without any `name` identifiers that would trigger _name2

interface Env {
  ORDERS: KVNamespace;
  WEBHOOK_TOKEN: string;

  GAS_URL: string;
  GAS_TOKEN: string;
  CORS_ORIGINS?: string;

  // Legacy Stripe (still used by webhook/confirm routes)
  STRIPE_SECRET_KEY: string;       // secret
  STRIPE_WEBHOOK_SECRET: string;   // secret

  // zahls.ch (Payrexx) – used by /api/checkout
  ZAHLS_INSTANCE: string;        // instance name
  ZAHLS_API_SECRET: string;      // secret

  PURCHASE_URL: string;
  PURCHASE_TOKEN?: string;

  SUCCESS_URL?: string;
  CANCEL_URL?: string;
}

type CartItem = {
  sku: string;
  size: string;
  color: string;
  qty: number;
  name?: string;        // product title (sent by frontend)
  title?: string;       // legacy
  unit_amount: number;  // in Rappen (CHF * 100)
  image?: string;
  isReturn?: boolean;      // true if user is returning old item
  returnDiscount?: number; // in Rappen
};

declare const caches: CacheStorage;

const enc = new TextEncoder();

const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "https://dlaumer.github.io/veloclub-horgen-webshop/",
  "https://dlaumer.github.io",
  "https://veloclub-horgen.ch",
  "http://webshop-veloclubhorgen.ch",
  "https://webshop-veloclubhorgen.ch"

];

const STOCK_CACHE_TTL = 30; // seconds

// ---------- Small helpers ----------
const asJSON = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

function parseOriginsCSV(csv?: string) {
  if (!csv) return [] as string[];
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function allowlist(env: Env) {
  return [...defaultAllowedOrigins, ...parseOriginsCSV(env.CORS_ORIGINS)];
}

function corsHeaders(origin: string | null, allowed: string[]) {
  if (origin && allowed.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Vary": "Origin",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    };
  }
  return {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
}

function urlPath(req: Request) {
  try {
    return new URL(req.url).pathname;
  } catch {
    return "/";
  }
}



async function verifyStripeSignature(sigHeader: string, raw: string, secret: string) {
  if (!sigHeader || !secret) return false;
  const parts = Object.fromEntries(sigHeader.split(",").map((kv) => kv.split("=") as [string, string]));
  const ts = parts["t"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  const payload = `${ts}.${raw}`;
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return hex(sig) === v1;
}

// ---------- GAS proxy helpers ----------
function gasTarget(env: Env, action: string, extraQuery = "") {
  const base =
    `${env.GAS_URL}?action=${encodeURIComponent(action)}&token=${encodeURIComponent(env.GAS_TOKEN)}`;
  return extraQuery ? `${base}&${extraQuery}` : base;
}

// ---------- Endpoints ----------

// GET /api/headers
async function handleHeaders(req: Request, env: Env) {
  const origin = req.headers.get("Origin");
  const allowed = allowlist(env);
  const cors = corsHeaders(origin, allowed);

  const snapshot: Record<string, string> = {};
  req.headers.forEach((v, k) => (snapshot[k] = v));
  return asJSON({ ok: true, headers: snapshot }, 200, cors);
}

// GET /api/stock (edge-cached)
async function handleStock(req: Request, env: Env, ctx: ExecutionContext) {
  const origin = req.headers.get("Origin");
  const allowed = allowlist(env);
  const cors = corsHeaders(origin, allowed);

  const target = gasTarget(env, "stock");

  const cache = caches.default;
  const cached = await cache.match(target);
  if (cached) {
    const text = await cached.text();
    return new Response(text, {
      status: cached.status,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const upstream = await fetch(target, { method: "GET" });
  const bodyText = await upstream.text();

  const resp = new Response(bodyText, {
    status: upstream.status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${STOCK_CACHE_TTL}`,
      ...cors,
    },
  });

  if (upstream.ok) {
    ctx.waitUntil(cache.put(target, resp.clone()));
  }
  return resp;
}

// GET /api/sku?sku=XYZ
async function handleSku(req: Request, env: Env) {
  const origin = req.headers.get("Origin");
  const allowed = allowlist(env);
  const cors = corsHeaders(origin, allowed);

  const url = new URL(req.url);
  const sku = (url.searchParams.get("sku") || "").trim();
  if (!sku) return asJSON({ ok: false, error: "Missing sku" }, 400, cors);

  const target = gasTarget(env, "sku", `sku=${encodeURIComponent(sku)}`);
  const upstream = await fetch(target, { method: "GET" });
  const text = await upstream.text();

  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

// POST /api/stock-delta  (JSON body passthrough to GAS)
async function handleStockDelta(req: Request, env: Env) {
  const origin = req.headers.get("Origin");
  const allowed = allowlist(env);
  const cors = corsHeaders(origin, allowed);

  let bodyText = await req.text();
  if (!bodyText) {
    // Optional query fallback: ?items=[...]&idempotencyKey=...
    const url = new URL(req.url);
    const itemsQS = url.searchParams.get("items");
    const idkQS = url.searchParams.get("idempotencyKey");
    if (itemsQS) {
      bodyText = JSON.stringify({
        items: JSON.parse(itemsQS),
        ...(idkQS ? { idempotencyKey: idkQS } : {}),
      });
    }
  }

  const target = gasTarget(env, "stockDelta");
  const upstream = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: bodyText || "{}",
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
// --- helpers: query encoding like the plugin ---
function buildQueryRFC3986(entries: Array<[string, string]>): string {
  // like PHP http_build_query(..., PHP_QUERY_RFC3986): spaces become %20
  return entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
}

function buildQueryRFC1738(entries: Array<[string, string]>): string {
  // like PHP default http_build_query: spaces become +
  return entries
    .map(([k, v]) => {
      const kk = encodeURIComponent(k).replace(/%20/g, "+");
      const vv = encodeURIComponent(v).replace(/%20/g, "+");
      return `${kk}=${vv}`;
    })
    .join("&");
}

async function hmacSha256Base64(secret: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  const bytes = new Uint8Array(sigBuf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function safeOriginFromReq(req: Request, env: Env): string {
  const base =
    env.RETURN_BASE_URL ||
    req.headers.get("origin") ||
    (req.headers.get("referer") ? new URL(req.headers.get("referer")!).origin : "") ||
    "https://webshop-veloclubhorgen.ch";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

// Full return url builder (no Stripe placeholders)
function buildReturnUrls(req: Request, env: Env, orderId?: string) {
  const base = safeOriginFromReq(req, env);
  const success = env.SUCCESS_URL || `${base}/thank-you${orderId ? `?orderId=${encodeURIComponent(orderId)}` : ""}`;
  const cancel = env.CANCEL_URL || `${base}/cancelled${orderId ? `?orderId=${encodeURIComponent(orderId)}` : ""}`;
  return { success, cancel };
}

// --- main ---
async function handleCheckout(req: Request, env: Env) {
  const body = await req.json().catch(() => ({} as any));
  const buyer = (body?.customer || {}) as {
    email?: string;
    name?: string;
    lastName?: string;
    phone?: string;
    street?: string;
    zip?: string;
    place?: string;
    countryISO?: string; // "CH"
  };

  const orderId = body?.orderId ? String(body.orderId) : String(Date.now());
  const cart = (Array.isArray(body?.cart) ? (body.cart as CartItem[]) : []) as CartItem[];

  const origin = req.headers.get("Origin");
  const allowed = allowlist(env);
  const cors = corsHeaders(origin, allowed);

  if (!cart.length) return asJSON({ error: "Empty cart" }, 400, cors);

  const instance = env.ZAHLS_INSTANCE;
  const apiSecret = env.ZAHLS_API_SECRET || env.ZAHLS_API_KEY;

  if (!instance) return asJSON({ error: "Missing ZAHLS_INSTANCE" }, 500, cors);
  if (!apiSecret) return asJSON({ error: "Missing ZAHLS_API_SECRET" }, 500, cors);

  const { success, cancel } = buildReturnUrls(req, env, orderId);

  // --- compute total cents (same intent as your Stripe code) ---
  let totalCents = 0;

  for (const item of cart) {
    const qty = Math.max(0, Number(item.qty || 0));
    const unitFull = Math.round(Number(item.unit_amount || 0)); // cents
    if (!qty) continue;

    if (item.isReturn && item.returnDiscount > 0 && qty > 0) {
      const discounted = Math.max(0, unitFull - Math.round(Number(item.returnDiscount || 0)));
      totalCents += discounted;
      if (qty > 1) totalCents += (qty - 1) * unitFull;
    } else {
      totalCents += qty * unitFull;
    }
  }

  if (!Number.isFinite(totalCents) || totalCents <= 0) {
    return asJSON({ error: "Invalid total" }, 400, cors);
  }

  // Compact cart for webhook stock update
  const compactCart = cart.map((i) => ({
    sku: i.sku || "",
    size: i.size || "",
    color: i.color || "",
    qty: Number(i.qty || 0),
    isReturn: !!i.isReturn,
    returnDiscount: Number(i.returnDiscount || 0),
  }));

  // Build basket lines with the same split logic so Zahls invoice matches your total
  const basketLines: Array<{ name: string; quantity: number; amount: number; sku?: string }> = [];

  const pushBasket = (name: string, quantity: number, amountCents: number, sku?: string) => {
    basketLines.push({
      name,
      quantity,
      amount: Math.round(amountCents),
      sku: sku || undefined,
    });
  };

  for (const item of cart) {
    const qty = Math.max(0, Number(item.qty || 0));
    if (!qty) continue;

    const title = item.name || item.sku || "Item";
    const unitFull = Math.round(Number(item.unit_amount || 0));

    if (item.isReturn && item.returnDiscount > 0 && qty > 0) {
      const discounted = Math.max(0, unitFull - Math.round(Number(item.returnDiscount || 0)));
      pushBasket(
        discounted === 0 ? `${title} (Return - Free)` : `${title} (Return - Discounted)`,
        1,
        discounted,
        item.sku
      );
      if (qty > 1) pushBasket(title, qty - 1, unitFull, item.sku);
    } else {
      pushBasket(title, qty, unitFull, item.sku);
    }
  }

  // Optional: force TWINT only. If your account ever rejects this, set false.
  const FORCE_TWINT_ONLY = true;

  // ---- build unsigned params (NO instance, NO ApiSignature) ----
  const signEntries: Array<[string, string]> = [];

  signEntries.push(["model", "Gateway"]);

  // Values used by the Woo plugin (safe defaults)
  signEntries.push(["validity", "15"]);
  signEntries.push(["skipResultPage", "1"]);
  signEntries.push(["preAuthorization", "0"]);
  signEntries.push(["chargeOnAuthorization", "0"]);

  if (FORCE_TWINT_ONLY) signEntries.push(["pm[0]", "twint"]);

  signEntries.push(["amount", String(totalCents)]);
  signEntries.push(["currency", "CHF"]);

  signEntries.push(["purpose", `Order ${orderId}`]);
  signEntries.push(["referenceId", orderId]);

  signEntries.push(["successRedirectUrl", success]);
  signEntries.push(["cancelRedirectUrl", cancel]);
  signEntries.push(["failedRedirectUrl", cancel]);

  // Fields (optional)
  if (buyer?.name) signEntries.push(["fields[forename][value]", String(buyer.name)]);
  if (buyer?.lastName) signEntries.push(["fields[surname][value]", String(buyer.lastName)]);
  if (buyer?.email) signEntries.push(["fields[email][value]", String(buyer.email)]);
  if (buyer?.phone) signEntries.push(["fields[phone][value]", String(buyer.phone)]);
  if (buyer?.street) signEntries.push(["fields[street][value]", String(buyer.street)]);
  if (buyer?.zip) signEntries.push(["fields[postcode][value]", String(buyer.zip)]);
  if (buyer?.place) signEntries.push(["fields[place][value]", String(buyer.place)]);
  if (buyer?.countryISO) signEntries.push(["fields[country][value]", String(buyer.countryISO)]);

  // Custom field for webhook cart
  signEntries.push(["fields[custom_field_1][name]", "cart"]);
  signEntries.push(["fields[custom_field_1][value]", JSON.stringify(compactCart)]);

  // Basket lines
  basketLines.forEach((p, i) => {
    signEntries.push([`basket[${i}][name]`, p.name]);
    signEntries.push([`basket[${i}][quantity]`, String(p.quantity)]);
    signEntries.push([`basket[${i}][amount]`, String(p.amount)]);
    if (p.sku) signEntries.push([`basket[${i}][sku]`, p.sku]);
  });

  // Sign string: RFC1738 (+ for spaces)
  const signString = buildQueryRFC1738(signEntries);
  const ApiSignature = await hmacSha256Base64(apiSecret, signString);

  // Send body: RFC3986 (%20 for spaces) AND include instance + ApiSignature
  const sendEntries: Array<[string, string]> = [
    ...signEntries,
    ["ApiSignature", ApiSignature],
    ["instance", instance],
  ];

  const bodyStr = buildQueryRFC3986(sendEntries);

  // URL includes ?instance=... as well (plugin behavior)
  const apiUrl = `https://api.zahls.ch/v1/Gateway/0/?instance=${encodeURIComponent(instance)}`;

  console.log("Zahls checkout", { apiUrl, orderId, totalCents });
  // console.log("Sign string:", signString); // enable only while debugging (can be long)
  // console.log("Body:", bodyStr);

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: bodyStr,
  });

  const txt = await res.text().catch(() => "");
  console.log("Zahls status:", res.status);
  if (!res.ok) {
    console.log("Zahls response:", txt);
    return asJSON({ error: `zahls error: ${txt}`, status: res.status }, 500, cors);
  }

  let json: any = {};
  try { json = JSON.parse(txt); } catch { json = {}; }

  const data = Array.isArray(json?.data) ? json.data[0] : json?.data;
  const link = data?.link;
  const gatewayId = data?.id;

  if (!link) {
    return asJSON({ error: "Zahls: missing link in response", raw: json }, 500, cors);
  }

  return asJSON({ url: link, gatewayId, orderId }, 200, cors);
}



// Utility: get line items from Stripe if metadata.cart is missing/too long
async function fetchLineItemsFromStripe(sessionId: string, env: Env) {
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${sessionId}/line_items?limit=100&expand[]=data.price.product`,
    { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } },
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`line_items fetch failed: ${res.status} ${t}`);
  }
  const li = await res.json();

  return (li.data || []).map((it: any) => {
    const product = it?.price?.product;
    return {
      sku: product?.metadata?.sku || "",
      size: product?.metadata?.size || "",
      color: product?.metadata?.color || "",
      qty: it?.quantity || 0,
      title: product?.name || it?.description || "",
      image: product?.images?.[0] || undefined,
      unit_amount:
        (it?.amount_total && it?.quantity)
          ? Math.round(it.amount_total / it.quantity)
          : it?.price?.unit_amount || 0,
    };
  });
}
async function handleWebhook(req: Request, env: Env) {
  // --- simple auth ---
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  if (!env.WEBHOOK_TOKEN || token !== env.WEBHOOK_TOKEN) {
    return new Response("forbidden", { status: 403 });
  }

  // --- Zahls JSON webhook ---
  const raw = await req.text();
  let body: any = {};
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return new Response("bad json", { status: 200 });
  }

  const tx = body?.transaction;
  if (!tx) return new Response("missing transaction", { status: 200 });

  // Only act on confirmed payments
  if (String(tx.status) !== "confirmed") return new Response("ignored", { status: 200 });

  const orderId = String(
    tx.referenceId ||
    tx.invoice?.referenceId ||
    tx.invoice?.paymentLink?.referenceId ||
    tx.invoice?.number ||
    tx.id
  );

  // ---- extract cart from invoice.custom_fields (our JSON string) ----
  const cfs = Array.isArray(tx?.invoice?.custom_fields) ? tx.invoice.custom_fields : [];
  const cartField = cfs.find((x: any) => String(x?.name).toLowerCase() === "cart");

  let cart: any[] = [];
  if (cartField?.value) {
    try {
      cart = JSON.parse(String(cartField.value));
    } catch (e) {
      console.error("cart JSON parse failed", { orderId, valuePreview: String(cartField.value).slice(0, 200) });
      return new Response("bad cart json", { status: 200 });
    }
  }

  if (!Array.isArray(cart) || cart.length === 0) {
    console.error("missing cart", { orderId, customFields: cfs.map((x: any) => x?.name) });
    return new Response("missing cart", { status: 200 });
  }

  // ---- products from Zahls invoice (authoritative for name + price) ----
  const products = Array.isArray(tx?.invoice?.products) ? tx.invoice.products : [];

  // Build quick lookup by sku, fallback by name
  const bySku = new Map<string, any[]>();
  const byName = new Map<string, any[]>();

  for (const p of products) {
    const sku = String(p?.sku || "");
    const name = String(p?.name || "");
    if (sku) (bySku.get(sku) ?? bySku.set(sku, []).get(sku)!)?.push(p);
    if (name) (byName.get(name) ?? byName.set(name, []).get(name)!)?.push(p);
  }

  // Build items in the shape Apps Script expects
  const itemsForEmail = cart.map((c: any) => {
    const sku = String(c?.sku || "");
    const qty = Number(c?.qty ?? 0) || 0;

    // try match by sku first
    let p = (sku && bySku.get(sku)?.[0]) || null;
    // fallback by name if sku missing
    if (!p && c?.name) p = byName.get(String(c.name))?.[0] || null;

    const title = String(p?.name || c?.name || sku || "Artikel");

    // Zahls product "price" in your payloads is already cents (e.g. 200 => CHF 2.00)
    const unit_amount =
      p?.price != null && Number.isFinite(Number(p.price)) ? Number(p.price) : undefined;

    return {
      sku,
      title,
      size: c?.size ? String(c.size) : "",
      color: c?.color ? String(c.color) : "",
      qty,
      unit_amount,           // cents
      image: c?.image || "", // optional if you ever include it in cart
      isReturn: !!c?.isReturn,
      returnDiscount: Number(c?.returnDiscount || 0) || 0,
    };
  });

  // ---- commit stock via GAS (use cart, as before) ----
  const stockPayload = {
    items: cart.map((i: any) => ({
      sku: String(i.sku || ""),
      size: String(i.size || ""),
      color: String(i.color || ""),
      qty: -Math.abs(Number(i.qty || 0)),
    })),
    idempotencyKey: orderId,
  };

  const stockTarget = gasTarget(env, "stockDelta");
  const upstream = await fetch(stockTarget, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(stockPayload),
  });

  if (!upstream.ok) {
    const txt = await upstream.text().catch(() => "");
    console.error("stockDelta failed", { orderId, status: upstream.status, body: txt });
    return new Response(`stock commit failed: ${upstream.status} ${txt}`, { status: 500 });
  }

  // ---- persist order status for frontend polling ----
  try {
    const orderKey = `order:${orderId}`;

    const orderRecord = {
      orderId,
      status: String(tx.status),          // confirmed
      mode: String(tx.mode || ""),        // LIVE
      amount: Number(tx.amount || 0),     // cents
      currency: String(tx.invoice?.currency || "CHF"),
      txId: Number(tx.id || 0),
      uuid: String(tx.uuid || ""),
      time: String(tx.time || ""),
      email: String(tx.contact?.email || ""),
    };

    await env.ORDERS.put(orderKey, JSON.stringify(orderRecord), {
      // keep for 30 days
      expirationTtl: 60 * 60 * 24 * 30,
    });
  } catch (e) {
    console.error("Failed to persist order in KV", { orderId, e });
    // DO NOT fail webhook for this
  }


  // ---- send email (do not fail webhook if this fails) ----
  try {
    const email = String(tx?.contact?.email || "");
    const name = `${tx?.contact?.firstname || ""} ${tx?.contact?.lastname || ""}`.trim() || "Customer";
    const total = Number(tx?.amount || 0) / 100;

    const emailBody = {
      action: "sendOrderEmail",
      order: { orderId, name, email, currency: "CHF", total, items: itemsForEmail },
    };

    const emailTarget = gasTarget(env, "sendOrderEmail");
    const emailResp = await fetch(emailTarget, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emailBody),
    });

    if (!emailResp.ok) {
      const txt = await emailResp.text().catch(() => "");
      console.error("sendOrderEmail failed", { orderId, status: emailResp.status, body: txt });
    }
  } catch (err) {
    console.error("sendOrderEmail threw", { orderId, err });
  }

  return new Response("ok", { status: 200 });
}


// GET /api/order-status?orderId=1768062933299
async function handleOrderStatus(req: Request, env: Env) {
  const origin = req.headers.get("Origin");
  const allowed = allowlist(env);
  const cors = corsHeaders(origin, allowed);

  const url = new URL(req.url);
  const orderId = (url.searchParams.get("orderId") || "").trim();

  if (!orderId) {
    return asJSON({ ok: false, error: "Missing orderId" }, 400, cors);
  }

  const key = `order:${orderId}`;
  const raw = await env.ORDERS.get(key);

  if (!raw) {
    // webhook may not have arrived yet
    return asJSON(
      {
        ok: true,
        found: false,
        status: "pending",
      },
      200,
      cors
    );
  }

  let data: any = {};
  try {
    data = JSON.parse(raw);
  } catch {
    data = { raw };
  }

  return asJSON(
    {
      ok: true,
      found: true,
      ...data,
    },
    200,
    cors
  );
}


// ---------- Free Order Handler (total = 0) ----------
async function handleFreeOrder(req: Request, env: Env) {
  const origin = req.headers.get("Origin");
  const allowed = allowlist(env);
  const cors = corsHeaders(origin, allowed);

  const body = await req.json().catch(() => ({} as any));
  const buyer = (body?.customer || {}) as {
    email?: string;
    name?: string;
    lastName?: string;
    street?: string;
    postalCode?: string;
    city?: string;
    country?: string;
  };

  const orderId = body?.orderId ? String(body.orderId) : String(Date.now());
  const cart = (Array.isArray(body?.cart) ? (body.cart as CartItem[]) : []) as CartItem[];

  if (!cart.length) return asJSON({ error: "Empty cart" }, 400, cors);

  // ---- commit stock via GAS ----
  const stockPayload = {
    items: cart.map((i: any) => ({
      sku: String(i.sku || ""),
      size: String(i.size || ""),
      color: String(i.color || ""),
      qty: -Math.abs(Number(i.qty || 0)),
    })),
    idempotencyKey: orderId,
  };

  const stockTarget = gasTarget(env, "stockDelta");
  const upstream = await fetch(stockTarget, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(stockPayload),
  });

  if (!upstream.ok) {
    const txt = await upstream.text().catch(() => "");
    console.error("stockDelta failed for free order", { orderId, status: upstream.status, body: txt });
    return asJSON({ error: `stock commit failed: ${upstream.status}` }, 500, cors);
  }

  // ---- persist order status for frontend polling ----
  try {
    const orderKey = `order:${orderId}`;
    const orderRecord = {
      orderId,
      status: "confirmed",
      mode: "FREE",
      amount: 0,
      currency: "CHF",
      txId: 0,
      uuid: "",
      time: new Date().toISOString(),
      email: String(buyer?.email || ""),
    };

    await env.ORDERS.put(orderKey, JSON.stringify(orderRecord), {
      expirationTtl: 60 * 60 * 24 * 30,
    });
  } catch (e) {
    console.error("Failed to persist free order in KV", { orderId, e });
  }

  // ---- Build items for email ----
  const itemsForEmail = cart.map((c: any) => ({
    sku: String(c?.sku || ""),
    title: String(c?.name || c?.sku || "Artikel"),
    size: c?.size ? String(c.size) : "",
    color: c?.color ? String(c.color) : "",
    qty: Number(c?.qty ?? 0) || 0,
    unit_amount: 0,
    image: c?.image || "",
    isReturn: !!c?.isReturn,
    returnDiscount: Number(c?.returnDiscount || 0) || 0,
  }));

  // ---- send email ----
  try {
    const email = String(buyer?.email || "");
    const name = `${buyer?.name || ""} ${buyer?.lastName || ""}`.trim() || "Customer";

    const emailBody = {
      action: "sendOrderEmail",
      order: { orderId, name, email, currency: "CHF", total: 0, items: itemsForEmail },
    };

    const emailTarget = gasTarget(env, "sendOrderEmail");
    const emailResp = await fetch(emailTarget, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emailBody),
    });

    if (!emailResp.ok) {
      const txt = await emailResp.text().catch(() => "");
      console.error("sendOrderEmail failed for free order", { orderId, status: emailResp.status, body: txt });
    }
  } catch (err) {
    console.error("sendOrderEmail threw for free order", { orderId, err });
  }

  // ---- Return success URL (frontend will redirect) ----
  const { success } = buildReturnUrls(req, env, orderId);
  return asJSON({ url: success }, 200, cors);
}

// ---------- CORS preflight ----------
function handleOptions(req: Request, env: Env) {
  const origin = req.headers.get("Origin");
  const allowed = allowlist(env);
  const cors = corsHeaders(origin, allowed);
  return new Response(null, { status: 204, headers: cors });
}

// ---------- Router ----------
export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const path = urlPath(req);

    if (req.method === "OPTIONS") return handleOptions(req, env);

    // Payment routes
    if (req.method === "POST" && path === "/api/checkout") return handleCheckout(req, env);
    if (req.method === "POST" && path === "/api/free-order") return handleFreeOrder(req, env);
    if (req.method === "POST" && path === "/api/webhook") return handleWebhook(req, env);
    if (req.method === "GET" && path === "/api/confirm") return handleConfirm(req, env);
    if (req.method === "GET" && path === "/api/order-status ") { return handleOrderStatus(req, env); }

    // GAS proxies
    if (req.method === "GET" && path === "/api/headers") return handleHeaders(req, env);
    if (req.method === "GET" && path === "/api/stock") return handleStock(req, env, ctx);
    if (req.method === "GET" && path === "/api/sku") return handleSku(req, env);
    if (req.method === "POST" && path === "/api/stock-delta") return handleStockDelta(req, env);

    // 404 with CORS
    const origin = req.headers.get("Origin");
    const allowed = allowlist(env);
    return asJSON({ ok: false, error: "Not found" }, 404, corsHeaders(origin, allowed));
  },
};
