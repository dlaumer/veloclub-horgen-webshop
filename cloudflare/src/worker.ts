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
  color: string;
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

// Prefer the site (Referer) as return base; fallback to API origin; allow ENV override
function buildReturnUrls(req: Request, env: Env) {
  const ref = req.headers.get("referer") || req.url;

  // Decide base URL:
  // - if coming from localhost -> http://localhost:8080/
  // - otherwise -> GitHub Pages URL
  const base = ref.includes("localhost")
    ? "http://localhost:8080/"
    : "http://webshop-veloclubhorgen.ch/";

  return {
    success: env.SUCCESS_URL || `${base}thank-you?sid={CHECKOUT_SESSION_ID}`,
    cancel: env.CANCEL_URL || `${base}cancelled`,
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
  const compactCart = cart.map((i) => ({ sku: i.sku, size: i.size, color: i.color, qty: i.qty }));
  form.set("metadata[cart]", JSON.stringify(compactCart));
  if (buyer && Object.keys(buyer).length) {
    form.set("metadata[customer]", JSON.stringify(buyer));
  }

  cart.forEach((item, i) => {
    const title = item.name || `Item ${i + 1}`;
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
    if (item.color)
      form.set(`line_items[${i}][price_data][product_data][metadata][color]`, item.color);
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


// POST /api/webhook (Stripe → us): verify signature, update stock via PURCHASE_URL
async function handleWebhook(req: Request, env: Env) {
  const raw = await req.text(); // RAW body required
  const sig = req.headers.get("stripe-signature") || "";
  const valid = await verifyStripeSignature(sig, raw, env.STRIPE_WEBHOOK_SECRET);
  let payload = null;
  if (!valid) return new Response("bad signature", { status: 400 });

  const event = JSON.parse(raw);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const orderId =
      (session?.metadata?.orderId as string) ||
      (session?.id as string);

    // Prefer compact metadata.cart; fallback to Stripe line_items
    let items: Array<{ sku: string; size: string; color: string; qty: number }> = [];
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

    payload = {
      // negative quantities, as your GAS expects
      items: items.map((i) => ({ sku: i.sku, size: i.size, color: i.color, qty: -Math.abs(i.qty) })),
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

    /**
 * --- SEND ORDER CONFIRMATION VIA GOOGLE APPS SCRIPT ---
 * We try to build a solid "order" object for the confirmation email.
 * Prefer data from your payment session (Stripe/TWINT), falling back to what's in `payload`.
 * - Do NOT fail the webhook if the email fails. Just log and continue.
 */
    try {
      // If your code already has a session object from Stripe:
      // const email = session?.customer_details?.email || session?.customer_email;
      // const name  = session?.customer_details?.name  || payload?.customer?.name || "Customer";
      // inside the try { ... } where you build the email
      const customer = session?.metadata?.customer
        ? JSON.parse(session.metadata.customer)
        : null;

      let items: any[] = [];
      try {
        // rich data from Stripe
        items = await fetchLineItemsFromStripe(session.id, env);
      } catch (e) {
        // fallback to compact metadata.cart if Stripe call fails
        const cart = session?.metadata?.cart
          ? JSON.parse(session.metadata.cart)
          : [];
        items = cart;
      }

      const email = customer?.email;
      const name = (customer?.name + " " + customer?.lastName) || "Customer";

      const currency = session?.currency || "CHF";
      const orderId =
        (session?.metadata?.orderId as string) || (session?.id as string);
      const total = (session?.amount_total || 0) / 100;

      const emailBody = {
        action: "sendOrderEmail",
        order: {
          orderId,
          name,
          email,
          currency,
          total,
          items, // now includes title/image/unit_amount
        },
      };

      // Call your Apps Script email endpoint
      const emailTarget = gasTarget(env, "sendOrderEmail"); // same base as stockDelta but different "route" helper
      const emailResp = await fetch(emailTarget, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailBody),
      });

      if (!emailResp.ok) {
        const txt = await emailResp.text().catch(() => "");
        console.error("Webhook: sendOrderEmail failed", {
          emailTarget,
          status: emailResp.status,
          body: txt,
        });
        // DO NOT throw — we don't want to fail the webhook because of email
      }
    } catch (err) {
      console.error("Webhook: sendOrderEmail threw", err);
      // swallow error to avoid breaking the webhook
    }
  }

  return new Response(`${JSON.stringify(payload)})`, { status: 200 });
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

// GET /api/checkout-session?sid=cs_test_...
async function handleCheckoutSession(req: Request, env: Env) {
  const origin = req.headers.get("Origin");
  const allowed = allowlist(env);
  const cors = corsHeaders(origin, allowed);

  const url = new URL(req.url);
  const sid = (url.searchParams.get("sid") || "").trim();

  if (!sid) {
    return asJSON({ ok: false, error: "Missing sid" }, 400, cors);
  }

  const stripeRes = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sid)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      },
    }
  );

  if (!stripeRes.ok) {
    const txt = await stripeRes.text().catch(() => "");
    return asJSON(
      {
        ok: false,
        error: `Stripe session fetch failed: ${stripeRes.status}`,
        body: txt,
      },
      500,
      cors
    );
  }

  const session = await stripeRes.json();
  // Return Stripe session directly (like your old `json(session)`)
  return asJSON(session, 200, cors);
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
    if (req.method === "GET" && path === "/api/checkout-session") { return handleCheckoutSession(req, env); }

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

