// pb_hooks/lib_zahls.js
//
// Shared helpers, loaded with require() from the *.pb.js route/hook files
// (PocketBase runs every hook/route handler in its own isolated JS context,
// so plain top-level code/functions can't be shared between them directly -
// this file is the workaround: it is never auto-loaded by PocketBase itself
// because it does NOT end in .pb.js, it only runs when required()'d).
//
// Ported from the old Cloudflare Worker (cloudflare/src/worker.ts) so the
// Zahls (Payrexx) payment flow behaves identically, just without the Worker.

// ---- base64 (goja's JS engine has no atob/btoa/Buffer) ----------------
function isHex(s) {
  return typeof s === "string" && /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0
}

function hexToBytes(hex) {
  let bytes = []
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16))
  }
  return bytes
}

function bytesToBase64(bytes) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  let result = ""
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]
    result +=
      chars[(chunk >> 18) & 63] + chars[(chunk >> 12) & 63] + chars[(chunk >> 6) & 63] + chars[chunk & 63]
  }
  const remaining = bytes.length - i
  if (remaining === 1) {
    const chunk = bytes[i] << 16
    result += chars[(chunk >> 18) & 63] + chars[(chunk >> 12) & 63] + "=="
  } else if (remaining === 2) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8)
    result += chars[(chunk >> 18) & 63] + chars[(chunk >> 12) & 63] + chars[(chunk >> 6) & 63] + "="
  }
  return result
}

// $security.hs256() is documented to return a "string" without specifying
// hex vs base64 - PocketBase's other security helpers (sha256, md5, ...)
// return hex, so we assume hex here and convert to base64 (what Zahls/
// Payrexx's ApiSignature expects). If the very first real checkout gets
// rejected by Zahls with a signature error, this is the first place to check.
function hmacSha256Base64(secret, message) {
  const digest = $security.hs256(message, secret)
  if (isHex(digest)) {
    return bytesToBase64(hexToBytes(digest))
  }
  return digest // assume it's already base64
}

// ---- query string builders (mirrors the old Worker + Payrexx/Woo plugin) ----
function buildQueryRFC3986(entries) {
  // spaces -> %20
  return entries.map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&")
}

function buildQueryRFC1738(entries) {
  // spaces -> +
  return entries
    .map(([k, v]) => {
      const kk = encodeURIComponent(k).replace(/%20/g, "+")
      const vv = encodeURIComponent(v).replace(/%20/g, "+")
      return kk + "=" + vv
    })
    .join("&")
}

// ---- refund (used when staff cancel a paid order from the admin dashboard) ----
// POST https://api.zahls.ch/v1/Transaction/{id}/refund?instance=... - same
// REST API family/auth scheme as the Gateway checkout call below (Zahls is
// a white-label of Payrexx - see https://developers.payrexx.com/reference/
// refund-a-transaction). Supports a partial refund via an "amount" body
// param (Rappen/cents); omitting it would refund the full original amount,
// but we always send it explicitly since staff can choose a partial amount
// in the cancel dialog.
//
// IMPORTANT caveat: Payrexx's docs type the {id} path param as an int32
// transaction id, NOT the uuid. The /api/webhook handler in veloclub.pb.js
// now stores tx.id (the numeric one) as provider_tx_id going forward, but
// any order paid BEFORE that change may have the uuid stored there
// instead, in which case this call will likely fail with 404 - see the
// thrown error message, which always includes the stored id so staff can
// fall back to refunding manually in the Zahls dashboard if needed.
//
// Throws on any failure (missing/invalid transaction id, Zahls rejects the
// refund, network error, etc.) - the caller (admin.pb.js's cancel route)
// does this BEFORE persisting the cancellation, so a thrown error aborts
// the whole request and the order is never marked cancelled without the
// customer actually having been refunded.
function refundOrderViaZahls(order, refundAmountChf) {
  const txId = order.get("provider_tx_id")
  if (!txId) {
    throw new BadRequestError(
      "Diese Bestellung hat keine gespeicherte Zahls-Transaktions-ID - Rückerstattung muss manuell im Zahls-Dashboard erfolgen.",
    )
  }

  const instance = $os.getenv("ZAHLS_INSTANCE")
  const apiSecret = $os.getenv("ZAHLS_API_SECRET")
  if (!instance) throw new InternalServerError("Missing ZAHLS_INSTANCE")
  if (!apiSecret) throw new InternalServerError("Missing ZAHLS_API_SECRET")

  const amountCents = Math.round(Number(refundAmountChf || 0) * 100)
  if (!isFinite(amountCents) || amountCents <= 0) {
    throw new BadRequestError("Invalid refund amount")
  }

  const signEntries = [["amount", String(amountCents)]]
  const signString = buildQueryRFC1738(signEntries)
  const apiSignature = hmacSha256Base64(apiSecret, signString)
  const sendEntries = signEntries.concat([
    ["ApiSignature", apiSignature],
    ["instance", instance],
  ])
  const bodyStr = buildQueryRFC3986(sendEntries)

  const apiUrl =
    "https://api.zahls.ch/v1/Transaction/" +
    encodeURIComponent(String(txId)) +
    "/refund?instance=" +
    encodeURIComponent(instance)

  const res = $http.send({
    url: apiUrl,
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: bodyStr,
  })

  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new InternalServerError(
      "Zahls-Rückerstattung fehlgeschlagen für Transaktion " +
        txId +
        " (Status " +
        res.statusCode +
        "): " +
        res.body,
    )
  }
}

// ---- return-redirect base URL resolution --------------------------------
// Used by /api/checkout and /api/free-order to build the success/cancel
// redirect URLs Zahls (or the free-order response) sends the browser to
// after payment. The server has no way to know on its own whether checkout
// was started from the real shop or from someone testing against
// localhost - both hit this same backend - so the frontend sends its own
// window.location.origin as `returnBaseUrl` in the checkout request, and
// this only honors it if it's the real shop domain or a localhost dev
// origin. Anything else falls back to the configured SHOP_BASE_URL, so a
// crafted request can't turn this into an open redirect to an arbitrary
// site.
function resolveReturnBaseUrl(requestedOrigin, configuredBaseUrl) {
  const fallback = String(configuredBaseUrl || "https://webshop-veloclubhorgen.ch").replace(/\/$/, "")
  const origin = String(requestedOrigin || "").trim().replace(/\/$/, "")
  if (!origin) return fallback
  if (/^https?:\/\/(www\.)?webshop-veloclubhorgen\.ch$/i.test(origin)) return origin
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin
  return fallback
}

// ---- return-promo helpers (identical logic to the old Worker) ----------
function normalizeReturnCategory(category) {
  const normalized = String(category || "").trim().toLowerCase()
  return normalized && normalized !== "no" ? normalized : ""
}

// ---- promo codes: server-authoritative resolution + pricing -------------
// Until this feature, checkout discounts were entirely client-computed:
// the frontend decided which cart line was "the free return item" and how
// much to discount it, then just told the server via isReturn/returnDiscount
// fields on the posted cart - the server (isValidReturnPromo, now removed)
// only ever checked the TYPED CODE against one hardcoded string, never
// re-derived or verified the discount amount itself. Anyone could hand-craft
// a checkout request claiming any discount on any item. Promo codes now
// live in the "promo_codes" collection (see pb_migrations/1783907000_
// create_promo_codes.js), managed from the admin dashboard, and every
// discount is computed HERE from the raw cart + the resolved code - never
// trusted from the client. See computeCartPricing below and its callers in
// veloclub.pb.js (checkout/webhook/free-order all funnel through
// finalizeOrder, which calls this internally).

/** Looks up an active promo code by its (case-insensitive) string. Returns
 * null if not found/inactive - callers should treat that as "no discount",
 * never as an error (a customer mistyping a code shouldn't break checkout). */
function resolvePromoCode(app, rawCode) {
  const code = String(rawCode || "").trim().toUpperCase()
  if (!code) return null
  try {
    const rec = app.findFirstRecordByFilter("promo_codes", "code = {:code} && active = true", { code: code })
    return { code: code, type: rec.get("type"), percentage: Number(rec.get("percentage") || 0) }
  } catch (err) {
    return null
  }
}

// Computes authoritative per-line and total pricing for a cart + resolved
// promo (or null promo = no discount). `cart` items are the raw shape the
// frontend posts: { sku, size, color, qty, name, unit_amount (Rappen),
// image, returnCategory }. Returns:
//   { lines: [{ sku, size, color, qty, name, image, returnCategory,
//               unitFull, discountCents, lineTotalCents, isReturn }],
//     subtotalCents, totalCents }
// `isReturn` on a line is ONLY ever set by the "return_category" promo type
// (used for that line's "Rückgabe-Rabatt" email badge) - percentage/
// free_order discounts show up in discountCents/lineTotalCents and the
// order-level subtotal-vs-total summary instead, never as a per-item badge,
// since they're not tied to any specific item.
function computeCartPricing(cart, promo) {
  const items = (Array.isArray(cart) ? cart : []).map((it) => ({
    sku: String(it.sku || ""),
    size: String(it.size || ""),
    color: String(it.color || ""),
    qty: Math.max(0, Number(it.qty || 0)),
    name: String(it.name || ""),
    image: String(it.image || ""),
    unitFull: Math.max(0, Math.round(Number(it.unit_amount || 0))),
    returnCategory: normalizeReturnCategory(it.returnCategory) || "no",
  }))

  const perLineDiscount = items.map(() => 0)

  if (promo && promo.type === "return_category") {
    // Within each distinct return_category present in the cart, the single
    // CHEAPEST line gets one unit free - mirrors src/lib/returnDiscount.ts's
    // client-side preview exactly (same algorithm, just now also enforced
    // here instead of only previewed there).
    const cheapestIndexByCategory = {}
    items.forEach((it, idx) => {
      const cat = it.returnCategory
      if (cat === "no" || it.qty <= 0) return
      const curIdx = cheapestIndexByCategory[cat]
      if (curIdx == null || it.unitFull < items[curIdx].unitFull) {
        cheapestIndexByCategory[cat] = idx
      }
    })
    Object.keys(cheapestIndexByCategory).forEach((cat) => {
      const idx = cheapestIndexByCategory[cat]
      perLineDiscount[idx] = items[idx].unitFull
    })
  }

  const lines = items.map((it, idx) => {
    const discount = Math.min(perLineDiscount[idx], it.unitFull)
    const lineTotal = it.qty > 0 ? Math.max(0, it.unitFull - discount) + Math.max(0, it.qty - 1) * it.unitFull : 0
    return Object.assign({}, it, {
      discountCents: it.qty > 0 ? discount : 0,
      isReturn: discount > 0,
      lineTotalCents: lineTotal,
    })
  })

  const subtotalCents = items.reduce((s, it) => s + it.unitFull * it.qty, 0)

  if (promo && promo.type === "percentage") {
    // Applied per-line (rounded per line, then summed) rather than only to
    // the grand total, so the itemized basket sent to Zahls and shown in
    // the confirmation email always sums to exactly totalCents below - no
    // rounding drift between the two.
    const pct = Math.min(100, Math.max(0, promo.percentage || 0))
    lines.forEach((l) => {
      const reduced = Math.round((l.lineTotalCents * (100 - pct)) / 100)
      l.discountCents += l.lineTotalCents - reduced
      l.lineTotalCents = reduced
    })
  } else if (promo && promo.type === "free_order") {
    lines.forEach((l) => {
      l.discountCents += l.lineTotalCents
      l.lineTotalCents = 0
    })
  }

  const totalCents = lines.reduce((s, l) => s + l.lineTotalCents, 0)

  return { lines: lines, subtotalCents: subtotalCents, totalCents: totalCents }
}

// ---- order emails: shared look & feel -----------------------------------
// Ported from the club's original Google Apps Script (see GoogleAppScript.txt,
// sendOrderEmail/resendOrderEmail) so the confirmation/ready/picked-up emails
// keep the same card layout, colors and item table the club is used to,
// instead of the plain one-line text emails this backend originally sent.
// All three emails below (sendOrderConfirmationEmail, sendReadyEmail,
// sendPickedUpEmail) share renderEmailShell() for the header/card/footer
// chrome, so a future style tweak only has to happen in one place.

const SHOP_NAME = "Velo Club Horgen"
// Same club logo the old Apps Script emails used - publicly reachable, so
// referenced directly by URL rather than fetched+inlined as a cid attachment
// (goja/PocketBase has no easy UrlFetchApp equivalent for that, and a plain
// <img src> works in effectively every mail client anyway).
const SHOP_LOGO_URL =
  "https://www.veloclub-horgen.ch/clubdesk/fileservlet?type=image&id=1000962&s=djEtuF-WHA9ki0P_HckwukZ6Ly4VbgyocWRDbswQV7sPSRY=&imageFormat=_512x512"

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// Swiss/German comma-decimal formatting ("51,00"), matching the original
// Apps Script emails - distinct from the period-decimal fmtMoney() used
// elsewhere in the admin dashboard, which follows a different convention.
function fmtMoneyDE(val) {
  const n = Number(val)
  if (!isFinite(n)) return "-"
  return n.toFixed(2).replace(".", ",")
}

// Wraps `innerHtml` in the shared header (shop name + order number + club
// logo) and footer ("Sportliche Grüsse") used by every order-related email.
function renderEmailShell(orderId, innerHtml) {
  return `
<div style="background:#f3f4f6;padding:20px 0;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #e5e7eb;padding:20px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#111;">

    <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e5e7eb;margin-bottom:14px;width:100%;">
      <tr>
        <td align="left" style="padding-bottom:10px;">
          <div style="font-size:18px;font-weight:700;">${SHOP_NAME} – Shop</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px;">
            ${orderId ? "Bestellung #" + escapeHtml(orderId) : ""}
          </div>
        </td>
        <td align="right" style="padding-bottom:10px;white-space:nowrap;">
          <img src="${SHOP_LOGO_URL}" alt="${escapeHtml(SHOP_NAME)} Logo" width="44" height="44"
            style="height:44px;width:44px;max-width:44px;max-height:44px;border-radius:9999px;display:inline-block;" />
        </td>
      </tr>
    </table>

    ${innerHtml}

    <p style="margin:14px 0 0 0;font-size:12px;color:#9ca3af;">
      Sportliche Grüsse<br>${SHOP_NAME}
    </p>

  </div>
</div>`
}

// Builds the item table (HTML) and a matching plain-text bullet list from
// computeCartPricing()'s `lines` - so the amounts shown here are always
// exactly what was actually charged (or, for the webhook path, what the
// idempotent lookup recomputes identically from the same cart+promo).
function buildItemRows(lines) {
  const rowsHtml = []
  const linesText = []

  for (const it of lines) {
    if (!it.qty) continue
    const title = it.name || it.sku || "Artikel"
    const unitChf = it.unitFull / 100
    const lineTotalChf = it.lineTotalCents / 100
    const price = `${fmtMoneyDE(unitChf)} CHF`
    const lineTotal = `${fmtMoneyDE(lineTotalChf)} CHF`

    // Only the "return_category" promo type marks individual lines this way
    // (see computeCartPricing) - a percentage/free-order discount isn't
    // tied to one specific item, so it's shown as an order-level summary
    // instead (see sendOrderConfirmationEmail), not a per-item badge here.
    const returnBadge = it.isReturn
      ? `<span style="margin-left:6px;display:inline-block;padding:1px 7px;border-radius:9999px;font-size:10.5px;font-weight:600;background:#fef3e2;color:#92600b;">Rückgabe-Rabatt</span>`
      : ""

    const imgUrl = it.image || ""
    const imgHtml = imgUrl
      ? `<img src="${imgUrl}" alt="${escapeHtml(title)}" width="72"
          style="display:block;width:72px;max-width:72px;height:auto;border-radius:8px;border:1px solid #eee;" />`
      : `<div style="width:72px;height:72px;border-radius:8px;background:#f5f5f5;border:1px solid #eee;"></div>`

    const sizeHtml = it.size ? `<div>Grösse: ${escapeHtml(it.size)}</div>` : ""
    const colorHtml = it.color ? `<div>Farbe: ${escapeHtml(it.color)}</div>` : ""

    rowsHtml.push(`
      <tr>
        <td width="90" style="padding:8px 10px;vertical-align:top;width:90px;">${imgHtml}</td>
        <td style="padding:8px 10px;vertical-align:top;">
          <div style="font-weight:600;">${escapeHtml(title)}${returnBadge}</div>
          <div style="font-size:12px;color:#555;">
            <div>Menge: ${it.qty}</div>
            ${sizeHtml}
            ${colorHtml}
          </div>
        </td>
        <td style="padding:8px 10px;vertical-align:top;text-align:right;font-size:12px;color:#555;white-space:nowrap;">
          <div>Einzelpreis</div>
          <div style="font-weight:600;">${price}</div>
        </td>
        <td style="padding:8px 10px;vertical-align:top;text-align:right;font-size:12px;color:#111;white-space:nowrap;">
          <div>Zeilensumme</div>
          <div style="font-weight:600;">${lineTotal}</div>
        </td>
      </tr>`)

    const sizeText = it.size ? ` (${it.size})` : ""
    const colorText = it.color ? `, Farbe: ${it.color}` : ""
    linesText.push(`• ${title}${sizeText}${colorText} × ${it.qty} — Einzelpreis: ${price}, Zeilensumme: ${lineTotal}`)
  }

  return { rowsHtml: rowsHtml.join(""), linesText: linesText.join("\n") }
}

// ---- order finalization: creates orders/order_items/logs + decrements stock ----
// `app` must be the (possibly transactional) app instance to use for all DB work.
// `input.cart`/`input.promoCode` are the RAW values (from the checkout
// request, echoed back via Zahls custom_fields for the webhook, or from
// the free-order request body) - this resolves the promo code and computes
// pricing itself via resolvePromoCode/computeCartPricing, ignoring any
// isReturn/returnDiscount-style fields a caller might still pass on cart
// items (nothing sets those anymore, but this never trusts them even if
// present). `input.amountCents` is different: it's what was ACTUALLY
// charged (Zahls' webhook confirmation, or 0 for a genuinely free order) -
// used for orders.amount_paid so our records always match real money
// movement, never silently overridden by a recomputation.
//
// Returns { order, pricing } - pricing.lines is what callers should pass to
// sendOrderConfirmationEmail (not the raw cart) so the email always matches
// what was actually computed/charged, including for the idempotent
// (already-processed) path below.
function finalizeOrder(app, input) {
  const promo = resolvePromoCode(app, input.promoCode)
  const pricing = computeCartPricing(input.cart, promo)

  // idempotency: Zahls may call the webhook more than once for the same tx
  try {
    const existing = app.findFirstRecordByFilter("orders", "order_number = {:on}", { on: input.orderId })
    return { order: existing, pricing: pricing }
  } catch (err) {
    // not found -> proceed to create it
  }

  // 1) pre-check stock for every line before writing anything
  // keyed by "sku|size" -> { article, item (the article_items row) }
  const stockBySkuSize = {}
  for (const line of pricing.lines) {
    if (!line.qty) continue
    const key = line.sku + "|" + line.size
    if (stockBySkuSize[key]) continue // same line seen twice, already validated

    const article = app.findFirstRecordByFilter("articles", "article_number = {:sku}", { sku: line.sku })
    const stockItem = app.findFirstRecordByFilter(
      "article_items",
      "article = {:aid} && size = {:size}",
      { aid: article.id, size: line.size },
    )
    const available = Number(stockItem.get("stock") || 0)
    if (line.qty > available) {
      throw new BadRequestError(
        "Nicht genug Lagerbestand fuer " + article.get("name") + " (" + line.size + "): verfuegbar " + available,
      )
    }
    stockBySkuSize[key] = { article, item: stockItem }
  }

  const ordersCollection = app.findCollectionByNameOrId("orders")
  const orderItemsCollection = app.findCollectionByNameOrId("order_items")
  const logsCollection = app.findCollectionByNameOrId("logs")

  const order = new Record(ordersCollection)
  order.set("order_number", input.orderId)
  order.set("buyer_name", input.buyerName || "")
  order.set("buyer_lastname", input.buyerLastname || "")
  order.set("buyer_email", input.buyerEmail || "")
  order.set("kidzbike", !!input.kidzbike)
  order.set("comments", input.comments || "")
  order.set("promo_code", promo ? promo.code : "")
  order.set("payment_provider", input.paymentProvider || "")
  order.set("payment_status", input.paymentStatus || "")
  order.set("amount_paid", Math.round(Number(input.amountCents || 0)) / 100)
  order.set("currency", input.currency || "CHF")
  order.set("provider_tx_id", input.providerTxId || "")
  order.set("placed_at", new Date().toISOString())
  // brand new order - it genuinely hasn't been prepared or picked up yet.
  order.set("ready", false)
  order.set("picked_up", false)
  app.save(order)

  for (const line of pricing.lines) {
    if (!line.qty) continue

    const key = line.sku + "|" + line.size
    const article = stockBySkuSize[key].article

    const orderItem = new Record(orderItemsCollection)
    orderItem.set("order", order.id)
    orderItem.set("article", article.id)
    orderItem.set("size", line.size || "")
    orderItem.set("color", line.color || "")
    orderItem.set("quantity", line.qty)
    orderItem.set("unit_price", line.unitFull / 100)
    orderItem.set("price_paid", line.lineTotalCents / 100)
    orderItem.set("is_return", line.isReturn)
    orderItem.set("return_category", line.returnCategory === "no" ? "" : line.returnCategory)
    app.save(orderItem)

    // decrement stock on the article_items row. Using the same shared
    // record reference (from stockBySkuSize) for repeated sku+size lines
    // so the in-memory value keeps compounding correctly across them.
    const stockItem = stockBySkuSize[key].item
    stockItem.set("stock", Number(stockItem.get("stock") || 0) - line.qty)
    app.save(stockItem)
  }

  const log = new Record(logsCollection)
  log.set("order", order.id)
  log.set("kind", "purchase")
  log.set("placed_at", order.get("placed_at"))
  log.set(
    "note",
    pricing.lines
      .filter((l) => l.qty)
      .map((l) => l.sku + " x" + l.qty + " (" + l.size + ")")
      .join(", "),
  )
  app.save(log)

  return { order: order, pricing: pricing }
}

const PICKUP_NOTE = "Die Abholung erfolgt bei Thömus Bike World in Au-Wädenswil."
const CONTACT_NOTE = "Bei Fragen antworte einfach auf diese E-Mail."

// Sends the "thanks for your order" email, itemized exactly like the
// original Apps Script version. `pricing` is what finalizeOrder() returned
// (see /api/checkout, /api/free-order and /api/webhook in veloclub.pb.js,
// which all already have it in scope) - NOT the raw cart, so the email
// always matches what was actually computed/charged, including a discount
// summary line when a promo_code (of any type) reduced the total.
function sendOrderConfirmationEmail(app, order, pricing) {
  try {
    const settings = app.settings()
    const orderId = order.get("order_number")
    const name = order.get("buyer_name") || "Liebe*r Kunde*in"
    const total = `${fmtMoneyDE(order.get("amount_paid"))} CHF`
    const comments = order.get("comments") || ""
    const lines = pricing && Array.isArray(pricing.lines) ? pricing.lines : []
    const { rowsHtml, linesText } = buildItemRows(lines)

    // subtotalCents comes from computeCartPricing (full price before any
    // promo discount) - amount_paid is what was actually charged. Only
    // show the discount line when they actually differ (small epsilon for
    // CHF rounding), covers all three promo types generically without the
    // email needing to know which one was used.
    const subtotalChf = pricing ? pricing.subtotalCents / 100 : Number(order.get("amount_paid") || 0)
    const amountPaidChf = Number(order.get("amount_paid") || 0)
    const discountChf = Math.max(0, subtotalChf - amountPaidChf)
    const promoCode = order.get("promo_code") || ""
    const hasDiscount = discountChf > 0.005

    const text = `${name},

vielen Dank für deine Bestellung #${orderId} beim ${SHOP_NAME}!

Bestellte Artikel:
${linesText}
${
  hasDiscount
    ? `\nZwischensumme: ${fmtMoneyDE(subtotalChf)} CHF\nRabatt (${promoCode}): -${fmtMoneyDE(discountChf)} CHF\n`
    : ""
}
Gesamtsumme: ${total}

${comments ? `Deine Bemerkung:\n${comments}\n\n` : ""}${PICKUP_NOTE}
${CONTACT_NOTE}

Sportliche Grüsse
${SHOP_NAME}
`

    const html = renderEmailShell(
      orderId,
      `
    <p style="margin:0 0 10px 0;">${escapeHtml(name)},</p>
    <p style="margin:0 0 14px 0;">
      vielen Dank für deine Bestellung Bestellnummer <span style="font-weight:600;">#${escapeHtml(orderId)}</span> beim <strong>${SHOP_NAME}</strong>!
    </p>

    <h3 style="font-size:15px;margin:12px 0 6px 0;">Bestellte Artikel</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div style="border-top:1px solid #e5e7eb;margin-top:10px;padding-top:10px;">
      ${
        hasDiscount
          ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#6b7280;margin-bottom:2px;">
        <span>Zwischensumme</span><span>${fmtMoneyDE(subtotalChf)} CHF</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:13px;color:#92600b;margin-bottom:6px;">
        <span>Rabatt (${escapeHtml(promoCode)})</span><span>-${fmtMoneyDE(discountChf)} CHF</span>
      </div>`
          : ""
      }
      <div style="display:flex;justify-content:flex-end;">
        <div style="text-align:right;font-size:14px;">
          <div style="color:#6b7280;">Gesamtsumme</div>
          <div style="font-size:18px;font-weight:700;">${total}</div>
        </div>
      </div>
    </div>

    ${
      comments
        ? `<div style="margin-top:14px;padding:12px;border-radius:10px;background:#f9fafb;border:1px solid #e5e7eb;">
      <div style="font-size:13px;font-weight:600;margin-bottom:4px;">Deine Bemerkung</div>
      <div style="font-size:13px;color:#374151;white-space:pre-wrap;">${escapeHtml(comments)}</div>
    </div>`
        : ""
    }

    <div style="margin-top:14px;font-size:13px;color:#374151;">
      <p style="margin:0 0 6px 0;">${escapeHtml(PICKUP_NOTE)}</p>
      <p style="margin:0 0 6px 0;">${escapeHtml(CONTACT_NOTE)}</p>
    </div>`,
    )

    const message = new MailerMessage({
      from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
      to: [{ address: order.get("buyer_email") }],
      subject: `Bestellbestätigung #${orderId} – ${SHOP_NAME}`,
      html: html,
      text: text,
    })
    app.newMailClient().send(message)
  } catch (err) {
    app.logger().error("order confirmation email failed", "orderId", order.get("order_number"), "error", err)
  }
}

// Same mailer/settings as sendOrderConfirmationEmail above - reuses whatever
// SMTP/sendmail is configured in Dashboard > Settings > Mail. Called from
// the onRecordUpdateRequest hook in veloclub.pb.js the moment ready flips
// false -> true, so this fires exactly once per order (never re-sent if
// ready gets toggled again, since that transition only happens once).
function sendReadyEmail(app, order) {
  try {
    const settings = app.settings()
    const orderId = order.get("order_number")
    const name = order.get("buyer_name") || "Liebe*r Kunde*in"

    const text = `${name},

Deine Bestellung #${orderId} ist bereit zur Abholung.

${PICKUP_NOTE}
${CONTACT_NOTE}

Sportliche Grüsse
${SHOP_NAME}
`

    const html = renderEmailShell(
      orderId,
      `
    <p style="margin:0 0 10px 0;">${escapeHtml(name)},</p>
    <p style="margin:0 0 14px 0;">
      Deine Bestellung <span style="font-weight:600;">#${escapeHtml(orderId)}</span> ist
      <strong>bereit zur Abholung</strong>! 🎉
    </p>
    <div style="font-size:13px;color:#374151;">
      <p style="margin:0 0 6px 0;">${escapeHtml(PICKUP_NOTE)}</p>
      <p style="margin:0 0 6px 0;">${escapeHtml(CONTACT_NOTE)}</p>
    </div>`,
    )

    const message = new MailerMessage({
      from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
      to: [{ address: order.get("buyer_email") }],
      subject: `Deine Bestellung #${orderId} ist bereit – ${SHOP_NAME}`,
      html: html,
      text: text,
    })
    app.newMailClient().send(message)
  } catch (err) {
    app.logger().error("ready email failed", "orderId", order.get("order_number"), "error", err)
  }
}

// New (the club's original Apps Script never had this one): a short
// receipt-style email once staff mark an order as picked up, matching the
// same shell/style as the other two. Called from the onRecordUpdateRequest
// hook in veloclub.pb.js the moment picked_up flips false -> true.
function sendPickedUpEmail(app, order) {
  try {
    const settings = app.settings()
    const orderId = order.get("order_number")
    const name = order.get("buyer_name") || "Liebe*r Kunde*in"

    const text = `${name},

vielen Dank - deine Bestellung #${orderId} wurde abgeholt. Wir hoffen, du hast Freude an deinen neuen Artikeln!

${CONTACT_NOTE}

Sportliche Grüsse
${SHOP_NAME}
`

    const html = renderEmailShell(
      orderId,
      `
    <p style="margin:0 0 10px 0;">${escapeHtml(name)},</p>
    <p style="margin:0 0 14px 0;">
      Vielen Dank – deine Bestellung <span style="font-weight:600;">#${escapeHtml(orderId)}</span> wurde
      <strong>abgeholt</strong>. Wir hoffen, du hast viel Freude an deinen neuen Artikeln!
    </p>
    <div style="font-size:13px;color:#374151;">
      <p style="margin:0 0 6px 0;">${escapeHtml(CONTACT_NOTE)}</p>
    </div>`,
    )

    const message = new MailerMessage({
      from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
      to: [{ address: order.get("buyer_email") }],
      subject: `Danke fürs Abholen – Bestellung #${orderId} – ${SHOP_NAME}`,
      html: html,
      text: text,
    })
    app.newMailClient().send(message)
  } catch (err) {
    app.logger().error("picked up email failed", "orderId", order.get("order_number"), "error", err)
  }
}

// Shared amber "correction" callout used by the two undo emails below - the
// same visual language as the "Rückgabe-Rabatt" badge in buildItemRows(),
// reused here to flag "this note is about fixing a mistake", not routine
// order info.
function renderCorrectionNotice(text) {
  return `<div style="margin:0 0 14px 0;padding:12px;border-radius:10px;background:#fef3e2;border:1px solid #fbdfae;">
      <div style="font-size:13px;font-weight:600;color:#92600b;margin-bottom:2px;">Korrektur</div>
      <div style="font-size:13px;color:#7a4e08;">${text}</div>
    </div>`
}

// Undo of "ready": staff flipped ready back to false, most likely because
// sendReadyEmail() already went out by mistake - let the customer know not
// to trust it. Called from the onRecordUpdateRequest hook the moment ready
// flips true -> false.
function sendReadyUndoEmail(app, order) {
  try {
    const settings = app.settings()
    const orderId = order.get("order_number")
    const name = order.get("buyer_name") || "Liebe*r Kunde*in"
    const correction =
      "Wir haben dir eben mitgeteilt, dass deine Bestellung bereit zur Abholung ist - das war leider ein Irrtum. " +
      "Bitte ignoriere diese vorherige Nachricht, deine Bestellung ist noch NICHT abholbereit. " +
      "Wir melden uns bei dir, sobald sie es wirklich ist."

    const text = `${name},

${correction}

${CONTACT_NOTE}

Sportliche Grüsse
${SHOP_NAME}
`

    const html = renderEmailShell(
      orderId,
      `
    <p style="margin:0 0 10px 0;">${escapeHtml(name)},</p>
    ${renderCorrectionNotice(escapeHtml(correction))}
    <div style="font-size:13px;color:#374151;">
      <p style="margin:0 0 6px 0;">${escapeHtml(CONTACT_NOTE)}</p>
    </div>`,
    )

    const message = new MailerMessage({
      from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
      to: [{ address: order.get("buyer_email") }],
      subject: `Korrektur zu deiner Bestellung #${orderId} – ${SHOP_NAME}`,
      html: html,
      text: text,
    })
    app.newMailClient().send(message)
  } catch (err) {
    app.logger().error("ready undo email failed", "orderId", order.get("order_number"), "error", err)
  }
}

// Undo of "picked up" - same idea as sendReadyUndoEmail, for when staff
// mark an order picked up by mistake. Called the moment picked_up flips
// true -> false.
function sendPickedUpUndoEmail(app, order) {
  try {
    const settings = app.settings()
    const orderId = order.get("order_number")
    const name = order.get("buyer_name") || "Liebe*r Kunde*in"
    const correction =
      "Wir haben dir eben mitgeteilt, dass deine Bestellung abgeholt wurde - das war leider ein Irrtum. " +
      "Bitte ignoriere diese vorherige Nachricht, deine Bestellung wartet weiterhin auf dich."

    const text = `${name},

${correction}

${CONTACT_NOTE}

Sportliche Grüsse
${SHOP_NAME}
`

    const html = renderEmailShell(
      orderId,
      `
    <p style="margin:0 0 10px 0;">${escapeHtml(name)},</p>
    ${renderCorrectionNotice(escapeHtml(correction))}
    <div style="font-size:13px;color:#374151;">
      <p style="margin:0 0 6px 0;">${escapeHtml(CONTACT_NOTE)}</p>
    </div>`,
    )

    const message = new MailerMessage({
      from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
      to: [{ address: order.get("buyer_email") }],
      subject: `Korrektur zu deiner Bestellung #${orderId} – ${SHOP_NAME}`,
      html: html,
      text: text,
    })
    app.newMailClient().send(message)
  } catch (err) {
    app.logger().error("picked up undo email failed", "orderId", order.get("order_number"), "error", err)
  }
}

module.exports = {
  hmacSha256Base64,
  buildQueryRFC3986,
  buildQueryRFC1738,
  resolveReturnBaseUrl,
  refundOrderViaZahls,
  normalizeReturnCategory,
  resolvePromoCode,
  computeCartPricing,
  finalizeOrder,
  sendOrderConfirmationEmail,
  sendReadyEmail,
  sendPickedUpEmail,
  sendReadyUndoEmail,
  sendPickedUpUndoEmail,
}
