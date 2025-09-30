declare const caches: { default: Cache };

export interface Env {
  GAS_URL: string;      // https://script.google.com/macros/s/AKfy.../exec
  GAS_TOKEN: string;    // API_TOKEN you set in Apps Script
  CORS_ORIGINS?: string; // CSV whitelist: "http://localhost:8080,https://yourapp.tld"
}

const DEFAULT_ALLOWED = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
];

function allowlist(env: Env): Set<string> {
  const extra = (env.CORS_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED, ...extra]);
}

function corsHeaders(origin: string | null, allowed: Set<string>) {
  if (origin && allowed.has(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Vary": "Origin",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
  }
  return {
    "Access-Control-Allow-Origin": "null",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

async function proxyJson(upstream: Response, headers: HeadersInit = {}) {
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin");
    const allowed = allowlist(env);

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin, allowed) });
    }

    try {
      if (url.pathname === "/api/stock" && req.method === "GET") {
        const target = `${env.GAS_URL}?action=stock`;
        const cache = caches.default;
        const cacheKey = new Request(target, { method: "GET" });

        const cors = corsHeaders(origin, allowed);

        // Try cache
        let cached = await cache.match(cacheKey);
        if (cached) {
          // Read the cached body and re-wrap with fresh CORS headers
          const text = await cached.text();
          return new Response(text, {
            status: cached.status,
            headers: {
              "Content-Type": "application/json",
              ...cors,
            },
          });
        }

        // Fetch upstream
        const upstream = await fetch(target, { method: "GET" });
        const bodyText = await upstream.text();

        // Build a version WITHOUT CORS for caching
        const cacheable = new Response(bodyText, {
          status: upstream.status,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=15",
          },
        });

        // Store in cache only if OK
        if (upstream.ok) {
          await cache.put(cacheKey, cacheable.clone());
        }

        // Return to client with CORS headers applied ONCE
        return new Response(bodyText, {
          status: upstream.status,
          headers: {
            "Content-Type": "application/json",
            ...cors,
          },
        });
      }


      if (url.pathname === "/api/purchase" && req.method === "POST") {
        const body = await req.text();
        const target = `${env.GAS_URL}?action=purchase&token=${encodeURIComponent(env.GAS_TOKEN)}`;
        const upstream = await fetch(target, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        return proxyJson(upstream, corsHeaders(origin, allowed));
      }

      return new Response(JSON.stringify({ ok: false, error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin, allowed) },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin, allowed) },
      });
    }
  },
}
