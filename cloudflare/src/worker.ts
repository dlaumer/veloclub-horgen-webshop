// worker.ts — Cloudflare Worker (TypeScript) without any `name` identifiers that would trigger _name2

interface Env {
  GAS_URL: string;
  GAS_TOKEN: string;
  CORS_ORIGINS?: string;

  STRIPE_SECRET_KEY: string;       // secret
  STRIPE_WEBHOOK_SECRET: string;   // secret

  PURCHASE_URL: string;
  PURCHASE_TOKEN?: string;

  SUCCESS_URL?: string;
  CANCEL_URL?: string;
}

type CartItem = {
  sku: string;
  size: string;
  qty: number;
  title?: string;       // product title for display in Stripe
  unit_amount: number;  // in Rappen (CHF * 100)
  image?: string;
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

// Prefer the site (Referer) as return base; fallback to API origin; allow ENV override
function buildReturnUrls(req: Request, env: Env) {
  const ref = req.headers.get("referer");
  const base = ref ? new URL(ref).origin : new URL(req.url).origin;
  return {
    success: env.SUCCESS_URL || `${base}/thank-you?sid={CHECKOUT_SESSION_ID}`,
    cancel: env.CANCEL_URL || `${base}/cancelled`,
  };
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

// POST /api/checkout  (create Stripe Checkout Session, TWINT-only)
async function handleCheckout(req: Request, env: Env) {
  const body = await req.json().catch(() => ({} as any));
  const buyer = (body?.customer || {}) as { email?: string };
  const orderId = body?.orderId as string | undefined;
  const cart = (Array.isArray(body?.cart) ? (body.cart as CartItem[]) : []) as CartItem[];

  const origin = req.headers.get("Origin");
  const allowed = allowlist(env);
  const cors = corsHeaders(origin, allowed);

  if (!cart.length) return asJSON({ error: "Empty cart" }, 400, cors);

  const { success, cancel } = buildReturnUrls(req, env);

  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.append("payment_method_types[]", "twint"); // TWINT-only
  form.set("success_url", success);
  form.set("cancel_url", cancel);

  if (orderId) {
    form.set("client_reference_id", String(orderId));
    form.set("metadata[orderId]", String(orderId));
  }
  if (buyer?.email) form.set("customer_email", buyer.email);

  // keep metadata small: only sku/size/qty
  const compactCart = cart.map((i) => ({ sku: i.sku, size: i.size, qty: i.qty }));
  form.set("metadata[cart]", JSON.stringify(compactCart));
  if (buyer && Object.keys(buyer).length) {
    form.set("metadata[customer]", JSON.stringify(buyer));
  }

  cart.forEach((item, i) => {
    const title = item.title || `Item ${i + 1}`;
    form.set(`line_items[${i}][quantity]`, String(item.qty));
    form.set(`line_items[${i}][price_data][currency]`, "chf"); // TWINT requires CHF
    form.set(`line_items[${i}][price_data][unit_amount]`, String(Math.round(Number(item.unit_amount))));
    form.set(`line_items[${i}][price_data][product_data][name]`, title);
    if (item.image) {
      form.set(`line_items[${i}][price_data][product_data][images][0]`, item.image);
    }
    if (item.sku)
      form.set(`line_items[${i}][price_data][product_data][metadata][sku]`, item.sku);
    if (item.size)
      form.set(`line_items[${i}][price_data][product_data][metadata][size]`, item.size);
  });

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  if (!stripeRes.ok) {
    const err = await stripeRes.text();
    return asJSON({ error: `Stripe error: ${err}` }, 500, cors);
  }

  const session = await stripeRes.json();
  return asJSON({ url: session.url }, 200, cors);
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
  return (li.data || [])
    .map((it: any) => ({
      sku: it?.price?.product?.metadata?.sku || "",
      size: it?.price?.product?.metadata?.size || "",
      qty: it?.quantity || 0,
    }))
    .filter((x: any) => x.sku && x.size && x.qty > 0);
}

// POST /api/webhook (Stripe → us): verify signature, update stock via PURCHASE_URL
async function handleWebhook(req: Request, env: Env) {
  const raw = await req.text(); // RAW body required
  const sig = req.headers.get("stripe-signature") || "";
  const valid = await verifyStripeSignature(sig, raw, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return new Response("bad signature", { status: 400 });

  const event = JSON.parse(raw);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const orderId =
      (session?.metadata?.orderId as string) ||
      (session?.id as string);

    // Prefer compact metadata.cart; fallback to Stripe line_items
    let items: Array<{ sku: string; size: string; qty: number }> = [];
    try {
      const parsed = JSON.parse(session?.metadata?.cart || "[]");
      if (Array.isArray(parsed) && parsed.length) {
        items = parsed;
      }
    } catch {
      // ignore
    }
    if (!items.length) {
      items = await fetchLineItemsFromStripe(session.id, env);
    }

    const payload = {
      // negative quantities, as your GAS expects
      items: items.map((i) => ({ sku: i.sku, size: i.size, qty: -Math.abs(i.qty) })),
      idempotencyKey: orderId,
    };
// Call GAS directly, same as /api/stock-delta does
      const target = gasTarget(env, "stockDelta");
      const upstream = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!upstream.ok) {
        const txt = await upstream.text().catch(() => "");
        console.error("Webhook: stockDelta call failed", {
          target,
          status: upstream.status,
          body: txt,
        });
        // Return 5xx so Stripe retries until stock update succeeds
        return new Response(`stock commit failed: ${upstream.status} ${txt}`, { status: 500 });
      }
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

  let items: Array<{ sku: string; size: string; qty: number }> = [];
  try {
    const parsed = JSON.parse(session?.metadata?.cart || "[]");
    if (Array.isArray(parsed) && parsed.length) items = parsed;
  } catch {}
  if (!items.length) {
    items = await fetchLineItemsFromStripe(session.id, env);
  }
  if (!items.length) return new Response("no items found", { status: 422 });

  const orderId = (session?.metadata?.orderId as string) || (session.id as string);
  const payload = {
    items: items.map((i) => ({ sku: i.sku, size: i.size, qty: -Math.abs(i.qty) })),
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
