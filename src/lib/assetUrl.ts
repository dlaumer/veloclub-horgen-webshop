// src/lib/assetUrl.ts
//
// Product/article images come from the stock backend as root-relative
// paths (e.g. "/images/Hoodie 255.png"), pointing at files that live in
// this site's own public/images folder (see backend/scripts/import_legacy_xlsx.*
// and backend/pb_hooks/veloclub.pb.js's /api/stock handler). A bare "/..."
// path only resolves correctly when the site is hosted at the domain
// root - it breaks the moment this build is deployed under a subfolder
// (e.g. https://example.com/neu/).
//
// `assetUrl` resolves these against wherever this build actually ended up
// (import.meta.env.BASE_URL), so the same dist/ output works unmodified
// whether it's served from the domain root, a subfolder, or opened
// straight from disk - no rebuild or config change needed per deployment.
// Accepts `unknown` rather than just `string | null` on purpose: the stock
// backend's data has been through a legacy Excel import and a couple of
// schema changes, so an "image" field occasionally isn't the plain string
// the types promise (e.g. an array, or some other stray value). This must
// never throw - a missing/odd image should render as a broken <img>, not
// crash the whole page.
export function assetUrl(path?: unknown): string {
  if (path == null) return "";
  if (Array.isArray(path)) return assetUrl(path[0]);
  if (typeof path !== "string") return "";

  const trimmed = path.trim();
  if (!trimmed) return "";

  // Already a full URL (http://, https://, protocol-relative //...) - leave as-is.
  if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(trimmed)) return trimmed;

  const base = import.meta.env.BASE_URL || "./";
  const cleanBase = base.endsWith("/") ? base : `${base}/`;
  const cleanPath = trimmed.replace(/^\/+/, "");
  return `${cleanBase}${cleanPath}`;
}
