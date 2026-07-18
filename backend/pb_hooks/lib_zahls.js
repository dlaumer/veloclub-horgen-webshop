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

// ---- return-promo helpers (identical logic to the old Worker) ----------
function normalizeReturnCategory(category) {
  const normalized = String(category || "").trim().toLowerCase()
  return normalized && normalized !== "no" ? normalized : ""
}

function isValidReturnPromo(promoCode, expectedCode) {
  const expected = String(expectedCode || "PROMOWEBSHOP").trim().toUpperCase()
  return String(promoCode || "").trim().toUpperCase() === expected
}

// cart items here are the same shape the frontend sends:
// { sku, size, color, qty, name, unit_amount (Rappen), image, isReturn, returnDiscount (Rappen), returnCategory }
function calculateCartTotalCents(cart) {
  let totalCents = 0
  for (const item of cart) {
    const qty = Math.max(0, Number(item.qty || 0))
    const unitFull = Math.round(Number(item.unit_amount || 0))
    if (!qty) continue
    if (item.isReturn && item.returnDiscount > 0) {
      const discounted = Math.max(0, unitFull - Math.round(Number(item.returnDiscount || 0)))
      totalCents += discounted
      if (qty > 1) totalCents += (qty - 1) * unitFull
    } else {
      totalCents += qty * unitFull
    }
  }
  return totalCents
}

// ---- order finalization: creates orders/order_items/logs + decrements stock ----
// `app` must be the (possibly transactional) app instance to use for all DB work.
// Returns the created (or, if already processed, the existing) orders record.
function finalizeOrder(app, input) {
  // idempotency: Zahls may call the webhook more than once for the same tx
  try {
    const existing = app.findFirstRecordByFilter("orders", "order_number = {:on}", { on: input.orderId })
    return existing
  } catch (err) {
    // not found -> proceed to create it
  }

  // 1) pre-check stock for every line before writing anything
  // keyed by "sku|size" -> { article, item (the article_items row) }
  const stockBySkuSize = {}
  for (const item of input.cart) {
    const qty = Math.max(0, Number(item.qty || 0))
    if (!qty) continue
    const key = item.sku + "|" + item.size
    if (stockBySkuSize[key]) continue // same line seen twice, already validated

    const article = app.findFirstRecordByFilter("articles", "article_number = {:sku}", { sku: item.sku })
    const stockItem = app.findFirstRecordByFilter(
      "article_items",
      "article = {:aid} && size = {:size}",
      { aid: article.id, size: item.size },
    )
    const available = Number(stockItem.get("stock") || 0)
    if (qty > available) {
      throw new BadRequestError(
        "Nicht genug Lagerbestand fuer " + article.get("name") + " (" + item.size + "): verfuegbar " + available,
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
  order.set("promo_code", input.promoCode || "")
  order.set("payment_provider", input.paymentProvider || "")
  order.set("payment_status", input.paymentStatus || "")
  order.set("amount_paid", Math.round(Number(input.amountCents || 0)) / 100)
  order.set("currency", input.currency || "CHF")
  order.set("provider_tx_id", input.providerTxId || "")
  order.set("placed_at", new Date().toISOString())
  // brand new order - unlike a legacy import, we genuinely know it hasn't
  // been prepared or picked up yet, so set the known state explicitly
  // rather than leaving the tri-state field at "" (= unknown/legacy).
  order.set("ready", "no")
  order.set("picked_up", "no")
  app.save(order)

  for (const item of input.cart) {
    const qty = Math.max(0, Number(item.qty || 0))
    if (!qty) continue

    const key = item.sku + "|" + item.size
    const article = stockBySkuSize[key].article
    const unitFull = Math.round(Number(item.unit_amount || 0))
    const isReturn = !!item.isReturn && Number(item.returnDiscount || 0) > 0
    const discount = isReturn ? Math.round(Number(item.returnDiscount || 0)) : 0
    const linePaidCents = isReturn
      ? Math.max(0, unitFull - discount) + (qty - 1) * unitFull
      : qty * unitFull

    const orderItem = new Record(orderItemsCollection)
    orderItem.set("order", order.id)
    orderItem.set("article", article.id)
    orderItem.set("size", item.size || "")
    orderItem.set("color", item.color || "")
    orderItem.set("quantity", qty)
    orderItem.set("unit_price", unitFull / 100)
    orderItem.set("price_paid", linePaidCents / 100)
    orderItem.set("is_return", isReturn)
    orderItem.set("return_category", normalizeReturnCategory(item.returnCategory))
    app.save(orderItem)

    // decrement stock on the article_items row. Using the same shared
    // record reference (from stockBySkuSize) for repeated sku+size lines
    // so the in-memory value keeps compounding correctly across them.
    const stockItem = stockBySkuSize[key].item
    stockItem.set("stock", Number(stockItem.get("stock") || 0) - qty)
    app.save(stockItem)
  }

  const log = new Record(logsCollection)
  log.set("order", order.id)
  log.set("kind", "purchase")
  log.set("placed_at", order.get("placed_at"))
  log.set(
    "note",
    input.cart.map((i) => i.sku + " x" + i.qty + " (" + i.size + ")").join(", "),
  )
  app.save(log)

  return order
}

function sendOrderConfirmationEmail(app, order) {
  try {
    const settings = app.settings()
    const message = new MailerMessage({
      from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
      to: [{ address: order.get("buyer_email") }],
      subject: "Deine Bestellung " + order.get("order_number") + " - Veloclub Horgen",
      html:
        "<p>Hoi " + order.get("buyer_name") + ",</p>" +
        "<p>Danke fuer deine Bestellung <strong>" + order.get("order_number") + "</strong> " +
        "ueber CHF " + order.get("amount_paid").toFixed(2) + ".</p>" +
        "<p>Wir melden uns, sobald sie bereit zur Abholung ist.</p>" +
        (order.get("comments") ? "<p>Deine Bemerkung: " + order.get("comments") + "</p>" : "") +
        "<p>Veloclub Horgen</p>",
    })
    app.newMailClient().send(message)
  } catch (err) {
    app.logger().error("order confirmation email failed", "orderId", order.get("order_number"), "error", err)
  }
}

module.exports = {
  hmacSha256Base64,
  buildQueryRFC3986,
  buildQueryRFC1738,
  normalizeReturnCategory,
  isValidReturnPromo,
  calculateCartTotalCents,
  finalizeOrder,
  sendOrderConfirmationEmail,
}
