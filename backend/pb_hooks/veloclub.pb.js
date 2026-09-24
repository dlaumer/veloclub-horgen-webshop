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
//
// Promo codes are no longer an env var - they're managed from the admin
// dashboard and live in the "promo_codes" collection (see pb_migrations/
// 1783907000_create_promo_codes.js and lib_zahls.js's resolvePromoCode/
// computeCartPricing, which is what actually enforces them now).
//
// Also make sure (Dashboard > Settings):
//   - Mail settings are configured (SMTP or sendmail), otherwise order
//     confirmation emails will silently fail (errors go to Dashboard > Logs).

// ---------------------------------------------------------------------
// GET /api/stock            -> { ok, data: Product[] }
// GET /api/stock?sku=XYZ    -> { ok, data: Product }   (Product = the group
//                               the sku belongs to, same as the list shape)
// ---------------------------------------------------------------------
routerAdd("GET", "/api/stock", (e) => {
  // Base used to build the article image URLs below. IMPORTANT: keep this
  // declared INSIDE the handler, not at module top-level - a top-level
  // const here isn't reliably in scope once this handler actually runs a
  // request in PocketBase's JSVM, which took down /api/stock in production
  // with "ReferenceError: API_BASE is not defined" until moved in here.
  // Any future routerAdd/onRecord*/etc. handler that needs a constant
  // should declare it inside the handler body for the same reason.
  const API_BASE = "https://api-webshop-veloclubhorgen.duckdns.org"

  // Builds full public URLs from the "images" file field (see
  // 1783901500_articles_uploaded_images.js) - every article's photos are
  // real uploaded files now, "image_urls" no longer exists (see
  // 1783902000_articles_drop_image_urls.js). Order of the returned array
  // matches the stored file order (see that migration's comments for how
  // to reorder/add/remove).
  function articleImageUrls(article) {
    const filenames = article.get("images") || []
    if (!Array.isArray(filenames) || !filenames.length) return []
    return filenames.map((fn) => API_BASE + "/api/files/articles/" + article.id + "/" + fn)
  }

  function toColor(article, itemsByArticle) {
    const images = articleImageUrls(article)
    const justStock = article.get("just_stock") || ""

    const items = (itemsByArticle[article.id] || []).slice()
    items.sort((a, b) => Number(a.get("sort_order") || 0) - Number(b.get("sort_order") || 0))
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
// GET /api/promo-code?code=XXX  -> { valid, type, percentage }
// Public, read-only preview so the frontend can show the right discount
// UI/amount as the customer types a code - NOT the source of truth for
// checkout itself (that's resolvePromoCode/computeCartPricing, called
// again independently by /api/checkout below, which never trusts what
// this route - or the client generally - claims). Deliberately returns
// almost nothing on an invalid/inactive code (just {valid: false}) rather
// than a 404/error, since "code not found" is an expected, normal result
// here, not a failure.
// ---------------------------------------------------------------------
routerAdd("GET", "/api/promo-code", (e) => {
  const zahls = require(`${__hooks}/lib_zahls.js`)
  const code = e.request.url.query().get("code") || ""
  const promo = zahls.resolvePromoCode(e.app, code)
  if (!promo) return e.json(200, { valid: false })
  return e.json(200, { valid: true, type: promo.type, percentage: promo.percentage })
})

// ---------------------------------------------------------------------
// POST /api/checkout  -> { url }  (redirect the browser to the Zahls link,
// or straight to the thank-you page for a fully-discounted/free order)
// ---------------------------------------------------------------------
routerAdd("POST", "/api/checkout", (e) => {
  const zahls = require(`${__hooks}/lib_zahls.js`)

  const body = e.requestInfo().body || {}
  const buyer = body.customer || {}
  const cart = Array.isArray(body.cart) ? body.cart : []
  const orderId = body.orderId ? String(body.orderId) : String(Date.now())
  const promoCodeRaw = body.promoCode || ""

  if (!cart.length) throw new BadRequestError("Empty cart")

  // Authoritative, server-side pricing - the ONLY thing that decides the
  // real charge. Any isReturn/returnDiscount-style fields the client might
  // still send on cart items are ignored entirely (computeCartPricing
  // never reads them); the promo code is looked up fresh here too, never
  // trusted from whatever the client claims about it.
  const promo = zahls.resolvePromoCode(e.app, promoCodeRaw)
  const pricing = zahls.computeCartPricing(cart, promo)
  if (!isFinite(pricing.totalCents) || pricing.totalCents < 0) {
    throw new BadRequestError("Invalid total")
  }

  // The frontend is a HashRouter (see src/App.tsx) - its routes only exist
  // after a "#", so a redirect URL without one (as this used to build)
  // loads the plain shop homepage instead of the thank-you/cancelled page,
  // with no orderId in scope at all. baseUrl itself is resolved to
  // wherever checkout was actually started from (production or a
  // localhost test), see resolveReturnBaseUrl's own comment.
  const baseUrl = zahls.resolveReturnBaseUrl(body.returnBaseUrl, $os.getenv("SHOP_BASE_URL"))
  const success = baseUrl + "/#/thank-you?orderId=" + encodeURIComponent(orderId)
  const cancel = baseUrl + "/#/cancelled?orderId=" + encodeURIComponent(orderId)

  // Raw cart values only (no client-claimed discount fields - those don't
  // exist as inputs anymore) - this is what finalizeOrder() will recompute
  // pricing from again later, whether that's right below (free order) or
  // from the webhook once Zahls confirms payment.
  const rawCart = cart.map((i) => ({
    sku: i.sku || "",
    size: i.size || "",
    color: i.color || "",
    qty: Number(i.qty || 0),
    name: i.name || "",
    unit_amount: Math.round(Number(i.unit_amount || 0)),
    image: i.image || "",
    returnCategory: zahls.normalizeReturnCategory(i.returnCategory) || "no",
  }))

  if (pricing.totalCents === 0) {
    // Fully discounted (a free_order promo, or a return_category/
    // percentage promo that happens to zero out this particular cart) -
    // nothing to charge, so skip Zahls entirely and finalize immediately.
    // This absorbs what used to be the separate /api/free-order endpoint -
    // the frontend no longer needs to guess which endpoint to call, since
    // only the server actually knows the real total.
    let result
    e.app.runInTransaction((txApp) => {
      result = zahls.finalizeOrder(txApp, {
        orderId: orderId,
        buyerName: buyer.name,
        buyerLastname: buyer.lastName,
        buyerEmail: buyer.email,
        kidzbike: !!buyer.kidzbike,
        comments: buyer.comments || "",
        promoCode: promoCodeRaw,
        paymentProvider: "free",
        paymentStatus: "confirmed",
        amountCents: 0,
        currency: "CHF",
        providerTxId: "",
        cart: rawCart,
      })
    })
    zahls.sendOrderConfirmationEmail(e.app, result.order, result.pricing)
    return e.json(200, { url: success, orderId: orderId })
  }

  const instance = $os.getenv("ZAHLS_INSTANCE")
  const apiSecret = $os.getenv("ZAHLS_API_SECRET")
  if (!instance) throw new InternalServerError("Missing ZAHLS_INSTANCE")
  if (!apiSecret) throw new InternalServerError("Missing ZAHLS_API_SECRET")

  // Itemized basket shown on the Zahls checkout page - cosmetic only, the
  // actual amount charged is the top-level "amount" param below
  // (pricing.totalCents), set independently of however these lines add up.
  // return_category discounts (one free unit per category) are reflected
  // per-line here, same as before; percentage/free_order discounts are
  // whole-order and shown via the real "amount" total instead of trying to
  // spread them across individual basket lines.
  const basketLines = []
  pricing.lines.forEach((line) => {
    if (!line.qty) return
    const title = line.name || line.sku || "Artikel"
    if (line.isReturn && line.discountCents > 0) {
      const discountedUnit = Math.max(0, line.unitFull - line.discountCents)
      if (discountedUnit > 0) {
        basketLines.push({
          name: title + " (Return - Discounted)",
          quantity: 1,
          amount: discountedUnit,
          sku: line.sku,
        })
      }
      if (line.qty > 1) basketLines.push({ name: title, quantity: line.qty - 1, amount: line.unitFull, sku: line.sku })
    } else {
      basketLines.push({ name: title, quantity: line.qty, amount: line.unitFull, sku: line.sku })
    }
  })

  const signEntries = [
    ["model", "Gateway"],
    ["validity", "15"],
    ["skipResultPage", "1"],
    ["preAuthorization", "0"],
    ["chargeOnAuthorization", "0"],
    ["amount", String(pricing.totalCents)],
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
  signEntries.push(["fields[custom_field_1][value]", JSON.stringify(rawCart)])
  signEntries.push(["fields[custom_field_2][name]", "kidzbike"])
  signEntries.push(["fields[custom_field_2][value]", buyer.kidzbike ? "true" : "false"])
  signEntries.push(["fields[custom_field_3][name]", "comments"])
  signEntries.push(["fields[custom_field_3][value]", String(buyer.comments || "")])
  // Echoed back to us via the webhook's tx.invoice.custom_fields, so
  // finalizeOrder() can resolve+recompute the SAME promo/pricing there
  // (the actual amount charged is already locked in via "amount" above,
  // set from the same computation - this is just so order.promo_code and
  // the per-line is_return/return_category attribution survive to the
  // webhook, not a second independent pricing decision).
  signEntries.push(["fields[custom_field_4][name]", "promoCode"])
  signEntries.push(["fields[custom_field_4][value]", promoCodeRaw])

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
// POST /api/free-order  -> { url }  (zero-total orders, e.g. a free_order
// promo code). SUPERSEDED by /api/checkout, which now absorbs this exact
// case itself (see its pricing.totalCents === 0 branch) - the frontend
// calls only /api/checkout going forward. Left in place (and still fully
// re-validated below via the same authoritative pricing engine, not
// trusting the client's claim that the total is zero) purely for backwards
// compatibility, in case anything else still points at this URL.
// ---------------------------------------------------------------------
routerAdd("POST", "/api/free-order", (e) => {
  const zahls = require(`${__hooks}/lib_zahls.js`)

  const body = e.requestInfo().body || {}
  const buyer = body.customer || {}
  const cart = Array.isArray(body.cart) ? body.cart : []
  const orderId = body.orderId ? String(body.orderId) : String(Date.now())
  const promoCodeRaw = body.promoCode || ""

  if (!cart.length) throw new BadRequestError("Empty cart")

  const promo = zahls.resolvePromoCode(e.app, promoCodeRaw)
  const pricing = zahls.computeCartPricing(cart, promo)
  if (pricing.totalCents !== 0) throw new BadRequestError("Free order total must be zero")

  let result
  e.app.runInTransaction((txApp) => {
    result = zahls.finalizeOrder(txApp, {
      orderId,
      buyerName: buyer.name,
      buyerLastname: buyer.lastName,
      buyerEmail: buyer.email,
      kidzbike: !!buyer.kidzbike,
      comments: buyer.comments || "",
      promoCode: promoCodeRaw,
      paymentProvider: "free",
      paymentStatus: "confirmed",
      amountCents: 0,
      currency: "CHF",
      providerTxId: "",
      cart: cart,
    })
  })

  zahls.sendOrderConfirmationEmail(e.app, result.order, result.pricing)

  // See the matching comment in /api/checkout above - both the missing "#"
  // (HashRouter) and the origin resolution (production vs. a localhost
  // test) apply here identically.
  const baseUrl = zahls.resolveReturnBaseUrl(body.returnBaseUrl, $os.getenv("SHOP_BASE_URL"))
  const success = baseUrl + "/#/thank-you?orderId=" + encodeURIComponent(orderId)
  return e.json(200, { url: success })
})

// ---------------------------------------------------------------------
// POST /api/webhook?token=...  - called by Zahls when a payment confirms
// ---------------------------------------------------------------------
routerAdd("POST", "/api/webhook", (e) => {
  const API_BASE = "https://api-webshop-veloclubhorgen.duckdns.org"

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
  // Echoed back from custom_field_4 set at checkout time (see /api/checkout
  // above) - findCf lowercases both sides, so this matches regardless of
  // the exact case used there.
  const promoCodeRaw = String(findCf("promocode") || "")

  const buyerEmail = (tx.contact && tx.contact.email) || ""
  const buyerName = (tx.contact && tx.contact.firstname) || ""
  const buyerLastname = (tx.contact && tx.contact.lastname) || ""

  let result
  try {
    e.app.runInTransaction((txApp) => {
      result = zahls.finalizeOrder(txApp, {
        orderId,
        buyerName,
        buyerLastname,
        buyerEmail,
        kidzbike,
        comments,
        promoCode: promoCodeRaw,
        paymentProvider: "zahls",
        paymentStatus: String(tx.status || ""),
        amountCents: Number(tx.amount || 0),
        currency: (tx.invoice && tx.invoice.currency) || "CHF",
        // tx.id (numeric) preferred over tx.uuid on purpose - Zahls/Payrexx's
        // refund/retrieve-transaction endpoints take the numeric id, not the
        // uuid (see refundOrderViaZahls in lib_zahls.js). Orders paid before
        // this change may still have the uuid stored here instead.
        providerTxId: String(tx.id || tx.uuid || ""),
        cart: cart,
      })
    })
  } catch (err) {
    // 500 -> Zahls will retry the webhook later (e.g. transient stock lock);
    // anything else we swallow with a 200 so Zahls doesn't spam retries.
    e.app.logger().error("webhook: finalize failed", "orderId", orderId, "error", err)
    return e.string(500, String(err))
  }

  zahls.sendOrderConfirmationEmail(e.app, result.order, result.pricing)

  return e.string(200, "ok")
})

// ---------------------------------------------------------------------
// GET /api/order-status?orderId=...  (not currently called by the frontend,
// kept for completeness / potential future use, e.g. an admin status page)
// ---------------------------------------------------------------------
routerAdd("GET", "/api/order-status", (e) => {
  const API_BASE = "https://api-webshop-veloclubhorgen.duckdns.org"

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

  // Cancelling must go through POST /api/admin/orders/{id}/cancel (see
  // admin.pb.js) instead of a plain PATCH here, on purpose: that route
  // refunds the order via Zahls BEFORE marking it cancelled, and aborts
  // the whole request if the refund fails. Checking this BEFORE e.next()
  // (unlike every other transition below, which checks after) is what
  // actually blocks it - e.next() is what persists the update, so
  // throwing here stops a direct PATCH from ever reaching the DB.
  if (!before.get("cancelled") && e.record.get("cancelled") === true) {
    throw new BadRequestError(
      "Cancelling an order must go through POST /api/admin/orders/{id}/cancel, not a direct PATCH",
    )
  }

  e.next()

  function addLog(kind, note) {
    const logsCollection = e.app.findCollectionByNameOrId("logs")
    const log = new Record(logsCollection)
    log.set("order", e.record.id)
    log.set("kind", kind)
    log.set("note", note || "")
    // e.auth is the authenticated "admins" record making this request
    // (orders.updateRule requires it - see
    // 1783900200_orders_admin_read_rules.js) - so this is always populated
    // for real staff actions. Falls back to email if the admin has no
    // display name set.
    log.set("admin_name", e.auth ? e.auth.get("name") || e.auth.get("email") : "")
    // these are live staff actions (toggling cancel/ready/pickup just now),
    // not historical/imported data, so "now" genuinely is when it happened.
    log.set("placed_at", new Date().toISOString())
    e.app.save(log)
  }

  // Cancellation itself (record update + refund + "cancel" log entry) now
  // all happens together in POST /api/admin/orders/{id}/cancel (admin.pb.js)
  // - see the guard above e.next(). Nothing to do here for that transition
  // anymore.

  // ready/picked_up are plain bools again (see
  // 1783902000_orders_ready_pickup_bool.js) - compare against real `true`.
  if (before.get("ready") !== true && e.record.get("ready") === true) {
    addLog("ready", "")
    // notify the customer - see sendReadyEmail in lib_zahls.js. Errors are
    // caught/logged there, never thrown, so a mail failure can't undo the
    // "ready" toggle that already saved above.
    const zahls = require(`${__hooks}/lib_zahls.js`)
    zahls.sendReadyEmail(e.app, e.record)
  }
  if (before.get("picked_up") !== true && e.record.get("picked_up") === true) {
    addLog("pickup", "")
    // notify the customer - see sendPickedUpEmail in lib_zahls.js (new -
    // the club's original system never sent one for this transition).
    const zahls = require(`${__hooks}/lib_zahls.js`)
    zahls.sendPickedUpEmail(e.app, e.record)
  }

  // Undo: the admin dashboard's "Rückgängig" buttons flip ready/picked_up
  // back to false. That USED to delete the matching "ready"/"pickup" log
  // entry (see 1783904000_logs_admin_delete_rule.js); now it stays - a
  // correction should be visible in the log, not erase what happened - and
  // a new "ready_undo"/"pickup_undo" entry records the correction itself
  // (see 1783905000_logs_undo_kinds.js for the schema change backing this).
  // The customer also gets told, since they may already have the original
  // "ready"/"picked up" email in their inbox.
  if (before.get("ready") === true && e.record.get("ready") === false) {
    addLog("ready_undo", "")
    const zahls = require(`${__hooks}/lib_zahls.js`)
    zahls.sendReadyUndoEmail(e.app, e.record)
  }
  if (before.get("picked_up") === true && e.record.get("picked_up") === false) {
    addLog("pickup_undo", "")
    const zahls = require(`${__hooks}/lib_zahls.js`)
    zahls.sendPickedUpUndoEmail(e.app, e.record)
  }
}, "orders")
