// worker.ts — Cloudflare Worker (TypeScript) without any `name` identifiers that would trigger _name2

interface Env {
  GAS_URL: string;
  GAS_TOKEN: string;
  CORS_ORIGINS?: string;

  ZAHLS_INSTANCE: string;       // secret
  ZAHLS_API_KEY: string;   // secret

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
  title?: string;       // product title for display in Stripe
  unit_amount: number;  // in Rappen (CHF * 100)
  image?: string;
  isReturn?: boolean;   // true if user is returning old item
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

function buildReturnUrls(req: Request, env: Env, orderId?: string) {
  // Prefer Origin (sent by browsers on fetch), then Referer, then a safe default
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  const base =
    env.RETURN_BASE_URL ||
    origin ||
    (referer ? new URL(referer).origin : "https://webshop-veloclubhorgen.ch");

  // Payrexx/Zahls: NO {CHECKOUT_SESSION_ID}
  // Instead, include your orderId (if you have one).
  const successUrl = env.SUCCESS_URL
    ? env.SUCCESS_URL
    : `${base}/thank-you${orderId ? `?orderId=${encodeURIComponent(orderId)}` : ""}`;

  const cancelUrl = env.CANCEL_URL
    ? env.CANCEL_URL
    : `${base}/cancelled${orderId ? `?orderId=${encodeURIComponent(orderId)}` : ""}`;

  return { success: successUrl, cancel: cancelUrl };
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
async function handleCheckout(req: Request, env: Env) {
  const origin = req.headers.get("Origin");
  const allowed = allowlist(env);
  const cors = corsHeaders(origin, allowed);

  console.log("🔥 MINIMAL checkout hit");
  console.log("Instance:", env.ZAHLS_INSTANCE);
  console.log("Has API key:", !!env.ZAHLS_API_KEY);

  // Hardcode return URLs (remove all dynamic logic)
  const success = "https://webshop-veloclubhorgen.ch/thank-you";
  const cancel  = "https://webshop-veloclubhorgen.ch/cancelled";

  // Absolute minimum params
  const form = new URLSearchParams();
  form.set("amount", "100"); // CHF 1.00 (cents)
  form.set("currency", "CHF");
  form.set("purpose", "Debug Test");

  // Try both keys (some setups accept one or the other)
  form.set("successRedirectUrl", success);
  form.set("cancelRedirectUrl", cancel);
  form.set("failedRedirectUrl", cancel);

  const url = `https://api.payrexx.com/v1.14/Gateway/?instance=${encodeURIComponent(env.ZAHLS_INSTANCE || "")}`;
  console.log("Payrexx URL:", url);
  console.log("Payrexx body:", form.toString());

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-API-KEY": env.ZAHLS_API_KEY || "",
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: form.toString(),
  });

  const txt = await res.text().catch(() => "");
  console.log("Payrexx status:", res.status);
  console.log("Payrexx response:", txt);

  if (!res.ok) {
    return asJSON({ error: `payrexx error: ${txt}`, status: res.status }, 500, cors);
  }

  let data: any = {};
  try { data = JSON.parse(txt); } catch {}

  const link = data?.data?.[0]?.link || data?.link;
  if (!link) {
    return asJSON({ error: "No link in Payrexx response", raw: data }, 500, cors);
  }

  return asJSON({ url: link }, 200, cors);
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
  const raw = await req.text();
  let body: any = {};
  try { body = JSON.parse(raw || "{}"); } catch { return new Response("bad json", { status: 200 }); }

  const tx = body?.transaction;
  if (!tx) return new Response("missing transaction", { status: 200 });

  // Only act on confirmed payments
  if (tx.status !== "confirmed") return new Response("ignored", { status: 200 });

  const instance = env.ZAHLS_INSTANCE;
  const apiKey = env.ZAHLS_API_KEY;

  // Prefer referenceId (you MUST set this when creating the gateway)
  const orderId = String(tx.referenceId || tx.invoice?.referenceId || tx.invoice?.number || tx.id);

  // ---- OPTIONAL verification (only if uuid exists) ----
  let vTx = tx;
  if (tx.uuid) {
    const verifyRes = await fetch(
      `https://api.payrexx.com/v1.14/Transaction/${encodeURIComponent(String(tx.uuid))}/?instance=${encodeURIComponent(instance)}`,
      {
        method: "GET",
        headers: { "X-API-KEY": apiKey, "Accept": "application/json" },
      }
    );

    if (!verifyRes.ok) {
      const err = await verifyRes.text().catch(() => "");
      // Return 500 so Payrexx retries (if you enabled retries)
      return new Response(`verify failed: ${verifyRes.status} ${err}`, { status: 500 });
    }

    const verified = await verifyRes.json();
    vTx = verified?.data?.[0] ?? verified?.transaction ?? verified;
  } else {
    // In test-webhook payloads uuid can be null; don't block the whole flow.
    // You can still be safe using referenceId + amount + idempotency checks.
  }

  // ---- Get cart data (you need to store it in the transaction) ----
  // In YOUR example payload, Payrexx gives you invoice.custom_fields as an array:
  // [{ name:"Hobby", value:"Fussball"}]
  // So store your cart there as e.g. name:"cart".
  const cf = Array.isArray(vTx?.invoice?.custom_fields) ? vTx.invoice.custom_fields : [];
  const cartField = cf.find((x: any) => x?.name === "cart");
  let cart: Array<{ sku: string; size: string; color: string; qty: number }> = [];
  try { cart = JSON.parse(String(cartField?.value || "[]")); } catch { }

  if (!cart.length) {
    console.error("Webhook: missing cart custom_field", { orderId });
    return new Response("missing cart", { status: 200 });
  }

  // ---- Commit stock (idempotent) ----
  const payload = {
    items: cart.map(i => ({ sku: i.sku, size: i.size, color: i.color, qty: -Math.abs(Number(i.qty || 0)) })),
    idempotencyKey: orderId,
  };

  const stockTarget = gasTarget(env, "stockDelta");
  const upstream = await fetch(stockTarget, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!upstream.ok) {
    const txt = await upstream.text().catch(() => "");
    return new Response(`stock commit failed: ${upstream.status} ${txt}`, { status: 500 });
  }

  // ---- Send email (don’t fail webhook if email fails) ----
  try {
    const email = vTx?.contact?.email || "";
    const name = `${vTx?.contact?.firstname || ""} ${vTx?.contact?.lastname || ""}`.trim() || "Customer";
    const total = Number(vTx?.amount || 0) / 100;

    const emailBody = {
      action: "sendOrderEmail",
      order: { orderId, name, email, currency: "CHF", total, items: cart },
    };

    const emailTarget = gasTarget(env, "sendOrderEmail");
    await fetch(emailTarget, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emailBody),
    });
  } catch (e) {
    console.error("Webhook: email failed", e);
  }

  return new Response("ok", { status: 200 });
}



// Optional: GET /api/confirm?sid=cs_...  (for thank-you UX)
async function handleConfirm(req: Request, env: Env) {
  const url = new URL(req.url);
  const sid = url.searchParams.get("sid");
  if (!sid) return new Response("missing sid", { status: 400 });

  const sRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sid}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  if (!sRes.ok) {
    const t = await sRes.text().catch(() => "");
    return new Response(`stripe session fetch failed: ${sRes.status} ${t}`, { status: 502 });
  }
  const session = await sRes.json();
  const paid = session.payment_status === "paid" || session.status === "complete";
  if (!paid) {
    return new Response(
      `not paid (status=${session.status}, payment_status=${session.payment_status})`,
      { status: 409 },
    );
  }

  let items: Array<{ sku: string; size: string; color: string; qty: number }> = [];
  try {
    const parsed = JSON.parse(session?.metadata?.cart || "[]");
    if (Array.isArray(parsed) && parsed.length) items = parsed;
  } catch { }
  if (!items.length) {
    items = await fetchLineItemsFromStripe(session.id, env);
  }
  if (!items.length) return new Response("no items found", { status: 422 });

  const orderId = (session?.metadata?.orderId as string) || (session.id as string);
  const payload = {
    items: items.map((i) => ({ sku: i.sku, size: i.size, color: i.color, qty: -Math.abs(i.qty) })),
    idempotencyKey: orderId,
  };

  const upstream = await fetch(env.PURCHASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.PURCHASE_TOKEN ? { Authorization: `Bearer ${env.PURCHASE_TOKEN}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!upstream.ok) {
    const txt = await upstream.text().catch(() => "");
    return new Response(`stock update failed: ${upstream.status} ${txt}`, { status: 502 });
  }

  return asJSON({ ok: true, orderId, itemsUpdated: items.length });
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

    // Stripe routes
    if (req.method === "POST" && path === "/api/checkout") return handleCheckout(req, env);
    if (req.method === "POST" && path === "/api/webhook") return handleWebhook(req, env);
    if (req.method === "GET" && path === "/api/confirm") return handleConfirm(req, env);

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

