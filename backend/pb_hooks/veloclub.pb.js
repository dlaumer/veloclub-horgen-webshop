/// <reference path="../pb_data/types.d.ts" />
//
// Veloclub Horgen webshop backend - replaces the old Cloudflare Worker +
// Google Apps Script setup entirely. The frontend talks directly to this
// PocketBase instance now.
//
// Drop this file, lib_zahls.js and the pb_migrations/*.js migration next to
// your pocketbase binary (this file in pb_hooks/, lib_zahls.js also in
// pb_hooks/ - it's only loaded via require() so it won't be picked up as a
// hook file on its own).
//
// Required environment variables (set them however you run pocketbase, e.g.
// in the systemd unit's Environment= lines, or a .env loaded by your process
// manager - PocketBase itself does not read .env files):
//   ZAHLS_INSTANCE       - your Zahls/Payrexx instance name
//   ZAHLS_API_SECRET     - your Zahls/Payrexx API secret
//   WEBHOOK_TOKEN        - shared secret, must match the "token" query param
//                          you configure in the Zahls webhook URL
//   SHOP_BASE_URL        - e.g. https://webshop-veloclubhorgen.ch (used to
//                          build the thank-you/cancelled redirect URLs)
//   RETURN_PROMO_CODE    - optional, defaults to "PROMOWEBSHOP"
//
// Also make sure (Dashboard > Settings):
//   - Mail settings are configured (SMTP or sendmail), otherwise order
//     confirmation emails will silently fail (errors go to Dashboard > Logs).
//   - General > Application URL is set to your public PocketBase URL
//     (https://api-webshop-veloclubhorgen.duckdns.org), it's used to build
//     the article image URLs returned by /api/stock.

// ---------------------------------------------------------------------
// GET /api/stock            -> { ok, data: Product[] }
// GET /api/stock?sku=XYZ    -> { ok, data: Product }   (Product = the group
//                               the sku belongs to, same as the list shape)
// ---------------------------------------------------------------------
routerAdd("GET", "/api/stock", (e) => {
  function toColor(article, itemsByArticle) {
    const images = article.get("image_urls") || []
    const justStock = article.get("just_stock") || ""

    const items = itemsByArticle[article.id] || []
    const sizes = items.map((it) => ({
      name: it.get("size"),
      stock: Number(it.get("stock") || 0),
      justStock: justStock,
    }))

    return {
      id: article.get("article_number"),
      name: article.get("color_name"),
      code: article.get("color_code"),
      images: images,
      image3d: article.get("embed_3d") || undefined,
      justStock: justStock,
      sizes: sizes,
    }
  }

  function toProduct(pid, variants, itemsByArticle) {
    // lowest sort_order among the color variants wins
    variants.sort((a, b) => Number(a.get("sort_order") || 0) - Number(b.get("sort_order") || 0))
    const first = variants[0]
    const colors = variants.map((a) => toColor(a, itemsByArticle))
    let totalStock = 0
    colors.forEach((c) => c.sizes.forEach((s) => (totalStock += s.stock)))

    return {
      id: pid,
      name: first.get("name"),
      price: first.get("price"),
      totalStock: totalStock,
      image: colors[0] && colors[0].images[0] ? colors[0].images[0] : "",
      image3d: first.get("embed_3d") || undefined,
      mainCategory: first.get("main_category"),
      category: first.get("category"),
      justStock: first.get("just_stock") || "",
      description: first.get("description"),
      isReturn: first.get("return_category") || "no",
      sortOrder: Number(first.get("sort_order") || 0),
      colors: colors,
    }
  }

  const sku = e.request.url.query().get("sku")
  const all = e.app.findAllRecords("articles")
  const allItems = e.app.findAllRecords("article_items")

  const itemsByArticle = {}
  for (const it of allItems) {
    const aid = it.get("article")
    if (!itemsByArticle[aid]) itemsByArticle[aid] = []
    itemsByArticle[aid].push(it)
  }

  if (sku) {
    const match = all.find((a) => a.get("article_number") === sku)
    if (!match) return e.json(404, { ok: false, error: "SKU not found" })
    const siblings = all.filter((a) => a.get("product_id") === match.get("product_id"))
    return e.json(200, { ok: true, data: toProduct(match.get("product_id"), siblings, itemsByArticle) })
  }

  const byProduct = {}
  const order = []
  for (const a of all) {
    const pid = a.get("product_id")
    if (!byProduct[pid]) {
      byProduct[pid] = []
      order.push(pid)
    }
    byProduct[pid].push(a)
  }

  const data = order
    .map((pid) => toProduct(pid, byProduct[pid], itemsByArticle))
    .sort((a, b) => a.sortOrder - b.sortOrder)
  return e.json(200, { ok: true, data: data })
})

// ---------------------------------------------------------------------
// POST /api/checkout  -> { url }  (redirect the browser to the Zahls link)
// ---------------------------------------------------------------------
routerAdd("POST", "/api/checkout", (e) => {
  const zahls = require(`${__hooks}/lib_zahls.js`)

  const body = e.requestInfo().body || {}
  const buyer = body.customer || {}
  const cart = Array.isArray(body.cart) ? body.cart : []
  const orderId = body.orderId ? String(body.orderId) : String(Date.now())

  if (!cart.length) throw new BadRequestError("Empty cart")

  const totalCents = zahls.calculateCartTotalCents(cart)
  if (!isFinite(totalCents) || totalCents <= 0) {
    throw new BadRequestError("Invalid total")
  }

  const instance = $os.getenv("ZAHLS_INSTANCE")
  const apiSecret = $os.getenv("ZAHLS_API_SECRET")
  if (!instance) throw new InternalServerError("Missing ZAHLS_INSTANCE")
  if (!apiSecret) throw new InternalServerError("Missing ZAHLS_API_SECRET")

  const baseUrl = ($os.getenv("SHOP_BASE_URL") || "https://webshop-veloclubhorgen.ch").replace(/\/$/, "")
  const success = baseUrl + "/thank-you?orderId=" + encodeURIComponent(orderId)
  const cancel = baseUrl + "/cancelled?orderId=" + encodeURIComponent(orderId)

  const basketLines = []
  for (const item of cart) {
    const qty = Math.max(0, Number(item.qty || 0))
    if (!qty) continue
    const title = item.name || item.sku || "Artikel"
    const unitFull = Math.round(Number(item.unit_amount || 0))

    if (item.isReturn && item.returnDiscount > 0) {
      const discounted = Math.max(0, unitFull - Math.round(Number(item.returnDiscount || 0)))
      if (discounted > 0) {
        basketLines.push({ name: title + " (Return - Discounted)", quantity: 1, amount: discounted, sku: item.sku })
      }
      if (qty > 1) basketLines.push({ name: title, quantity: qty - 1, amount: unitFull, sku: item.sku })
    } else {
      basketLines.push({ name: title, quantity: qty, amount: unitFull, sku: item.sku })
    }
  }

  const compactCart = cart.map((i) => ({
    sku: i.sku || "",
    size: i.size || "",
    color: i.color || "",
    qty: Number(i.qty || 0),
    name: i.name || "",
    unit_amount: Math.round(Number(i.unit_amount || 0)),
    image: i.image || "",
    isReturn: !!i.isReturn,
    returnDiscount: Number(i.returnDiscount || 0),
    returnCategory: zahls.normalizeReturnCategory(i.returnCategory) || "no",
  }))

  const signEntries = [
    ["model", "Gateway"],
    ["validity", "15"],
    ["skipResultPage", "1"],
    ["preAuthorization", "0"],
    ["chargeOnAuthorization", "0"],
    ["amount", String(totalCents)],
    ["currency", "CHF"],
    ["purpose", "Order " + orderId],
    ["referenceId", orderId],
    ["successRedirectUrl", success],
    ["cancelRedirectUrl", cancel],
    ["failedRedirectUrl", cancel],
  ]

  if (buyer.name) signEntries.push(["fields[forename][value]", String(buyer.name)])
  if (buyer.lastName) signEntries.push(["fields[surname][value]", String(buyer.lastName)])
  if (buyer.email) signEntries.push(["fields[email][value]", String(buyer.email)])

  signEntries.push(["fields[custom_field_1][name]", "cart"])
  signEntries.push(["fields[custom_field_1][value]", JSON.stringify(compactCart)])
  signEntries.push(["fields[custom_field_2][name]", "kidzbike"])
  signEntries.push(["fields[custom_field_2][value]", buyer.kidzbike ? "true" : "false"])
  signEntries.push(["fields[custom_field_3][name]", "comments"])
  signEntries.push(["fields[custom_field_3][value]", String(buyer.comments || "")])

  basketLines.forEach((p, i) => {
    signEntries.push(["basket[" + i + "][name]", p.name])
    signEntries.push(["basket[" + i + "][quantity]", String(p.quantity)])
    signEntries.push(["basket[" + i + "][amount]", String(p.amount)])
    if (p.sku) signEntries.push(["basket[" + i + "][sku]", p.sku])
  })

  const signString = zahls.buildQueryRFC1738(signEntries)
  const apiSignature = zahls.hmacSha256Base64(apiSecret, signString)

  const sendEntries = signEntries.concat([
    ["ApiSignature", apiSignature],
    ["instance", instance],
  ])
  const bodyStr = zahls.buildQueryRFC3986(sendEntries)

  const apiUrl = "https://api.zahls.ch/v1/Gateway/0/?instance=" + encodeURIComponent(instance)

  const res = $http.send({
    url: apiUrl,
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: bodyStr,
  })

  if (res.statusCode < 200 || res.statusCode >= 300) {
    e.app.logger().error("Zahls checkout failed", "status", res.statusCode, "body", res.body)
    throw new InternalServerError("Zahls error")
  }

  const json = res.json || {}
  const data = Array.isArray(json.data) ? json.data[0] : json.data
  const link = data && data.link
  if (!link) throw new InternalServerError("Zahls: missing link in response")

  return e.json(200, { url: link, gatewayId: data.id, orderId: orderId })
})

// ---------------------------------------------------------------------
// POST /api/free-order  -> { url }  (zero-total orders, e.g. full return promo)
// ---------------------------------------------------------------------
routerAdd("POST", "/api/free-order", (e) => {
  const zahls = require(`${__hooks}/lib_zahls.js`)

  const body = e.requestInfo().body || {}
  const buyer = body.customer || {}
  const cart = Array.isArray(body.cart) ? body.cart : []
  const orderId = body.orderId ? String(body.orderId) : String(Date.now())

  if (!cart.length) throw new BadRequestError("Empty cart")

  const totalCents = zahls.calculateCartTotalCents(cart)
  if (totalCents !== 0) throw new BadRequestError("Free order total must be zero")

  let order
  e.app.runInTransaction((txApp) => {
    order = zahls.finalizeOrder(txApp, {
      orderId,
      buyerName: buyer.name,
      buyerLastname: buyer.lastName,
      buyerEmail: buyer.email,
      kidzbike: !!buyer.kidzbike,
      comments: buyer.comments || "",
      promoCode: body.promoCode || "",
      paymentProvider: "free",
      paymentStatus: "confirmed",
      amountCents: 0,
      currency: "CHF",
      providerTxId: "",
      cart: cart,
    })
  })

  zahls.sendOrderConfirmationEmail(e.app, order)

  const baseUrl = ($os.getenv("SHOP_BASE_URL") || "https://webshop-veloclubhorgen.ch").replace(/\/$/, "")
  const success = baseUrl + "/thank-you?orderId=" + encodeURIComponent(orderId)
  return e.json(200, { url: success })
})

// ---------------------------------------------------------------------
// POST /api/webhook?token=...  - called by Zahls when a payment confirms
// ---------------------------------------------------------------------
routerAdd("POST", "/api/webhook", (e) => {
  const zahls = require(`${__hooks}/lib_zahls.js`)

  const token = e.request.url.query().get("token") || ""
  const expected = $os.getenv("WEBHOOK_TOKEN") || ""
  if (!expected || token !== expected) {
    return e.string(403, "forbidden")
  }

  const body = e.requestInfo().body || {}
  const tx = body.transaction
  if (!tx) return e.string(200, "missing transaction")
  if (String(tx.status) !== "confirmed") return e.string(200, "ignored")

  const orderId = String(
    tx.referenceId || (tx.invoice && tx.invoice.referenceId) || (tx.invoice && tx.invoice.number) || tx.id,
  )

  const customFields = (tx.invoice && tx.invoice.custom_fields) || []
  function findCf(name) {
    for (const cf of customFields) {
      if (String(cf.name).toLowerCase() === name) return cf.value
    }
    return undefined
  }

  let cart = []
  try {
    cart = JSON.parse(String(findCf("cart") || "[]"))
  } catch (err) {
    e.app.logger().error("webhook: bad cart json", "orderId", orderId)
    return e.string(200, "bad cart json")
  }
  if (!Array.isArray(cart) || !cart.length) {
    e.app.logger().error("webhook: missing cart", "orderId", orderId)
    return e.string(200, "missing cart")
  }

  const kidzbikeRaw = findCf("kidzbike")
  const kidzbike = kidzbikeRaw === true || kidzbikeRaw === "true" || kidzbikeRaw === "1"
  const comments = String(findCf("comments") || "")

  const buyerEmail = (tx.contact && tx.contact.email) || ""
  const buyerName = (tx.contact && tx.contact.firstname) || ""
  const buyerLastname = (tx.contact && tx.contact.lastname) || ""

  let order
  try {
    e.app.runInTransaction((txApp) => {
      order = zahls.finalizeOrder(txApp, {
        orderId,
        buyerName,
        buyerLastname,
        buyerEmail,
        kidzbike,
        comments,
        promoCode: "",
        paymentProvider: "zahls",
        paymentStatus: String(tx.status || ""),
        amountCents: Number(tx.amount || 0),
        currency: (tx.invoice && tx.invoice.currency) || "CHF",
        providerTxId: String(tx.uuid || tx.id || ""),
        cart: cart,
      })
    })
  } catch (err) {
    // 500 -> Zahls will retry the webhook later (e.g. transient stock lock);
    // anything else we swallow with a 200 so Zahls doesn't spam retries.
    e.app.logger().error("webhook: finalize failed", "orderId", orderId, "error", err)
    return e.string(500, String(err))
  }

  zahls.sendOrderConfirmationEmail(e.app, order)

  return e.string(200, "ok")
})

// ---------------------------------------------------------------------
// GET /api/order-status?orderId=...  (not currently called by the frontend,
// kept for completeness / potential future use, e.g. an admin status page)
// ---------------------------------------------------------------------
routerAdd("GET", "/api/order-status", (e) => {
  const orderId = e.request.url.query().get("orderId") || ""
  if (!orderId) throw new BadRequestError("Missing orderId")

  let order
  try {
    order = e.app.findFirstRecordByFilter("orders", "order_number = {:on}", { on: orderId })
  } catch (err) {
    return e.json(200, { ok: true, found: false, status: "pending" })
  }

  return e.json(200, {
    ok: true,
    found: true,
    orderId: order.get("order_number"),
    status: order.get("payment_status"),
    amount: Math.round(Number(order.get("amount_paid") || 0) * 100),
    currency: order.get("currency"),
    email: order.get("buyer_email"),
  })
})

// ---------------------------------------------------------------------
// Staff toggles (ready / picked up / cancelled) via the admin dashboard
// -> write a matching entry to the logs collection.
// ---------------------------------------------------------------------
onRecordUpdateRequest((e) => {
  const before = e.app.findRecordById("orders", e.record.id)

  e.next()

  function addLog(kind, note) {
    const logsCollection = e.app.findCollectionByNameOrId("logs")
    const log = new Record(logsCollection)
    log.set("order", e.record.id)
    log.set("kind", kind)
    log.set("note", note || "")
    // these are live staff actions (toggling cancel/ready/pickup just now),
    // not historical/imported data, so "now" genuinely is when it happened.
    log.set("placed_at", new Date().toISOString())
    e.app.save(log)
  }

  if (!before.get("cancelled") && e.record.get("cancelled")) {
    addLog("cancel", e.record.get("cancelled_note"))
  }
  // ready/picked_up are tri-state text now ("" unknown/legacy | "yes" | "no"),
  // so compare against the string "yes" instead of a bare truthy bool.
  if (before.get("ready") !== "yes" && e.record.get("ready") === "yes") {
    addLog("ready", "")
  }
  if (before.get("picked_up") !== "yes" && e.record.get("picked_up") === "yes") {
    addLog("pickup", "")
  }
}, "orders")
