/// <reference path="../pb_data/types.d.ts" />
//
// Admin-dashboard-facing routes for the Veloclub Horgen webshop backend.
// Separate from veloclub.pb.js (which handles the public checkout/payment
// flow) - this file is for staff-only catalog management.
//
// Routes here accept EITHER a superuser token OR a token from the
// "admins" auth collection (see pb_migrations/1783900000_create_admins_
// collection.js) - the dashboard's login page authenticates staff via:
//   POST /api/collections/admins/auth-with-password
//   { "identity": "staff@example.com", "password": "..." }
// -> { "token": "...", "record": {...} }
// and then sends that token as the Authorization header on every request.
//
// For everything NOT covered here - listing articles, editing an existing
// article's fields, DELETING an article, editing/restocking an existing
// article_items row - the dashboard can call PocketBase's normal REST API
// directly with that same admins (or superuser) token, no custom route
// needed, since 1783900100_articles_admin_write_rules.js already opened
// articles/article_items create+update+delete to any "admins" token:
//   GET    /api/collections/articles/records
//   GET    /api/collections/articles/records/{id}
//   PATCH  /api/collections/articles/records/{id}
//   DELETE /api/collections/articles/records/{id}
//   (same pattern for article_items)
//
// This also covers uploading/reordering/removing product images (the
// "images" file field added in pb_migrations/1783901500_articles_
// uploaded_images.js) - it's just a normal PATCH to the article's record,
// see that migration file's comments for the exact multipart/JSON shapes.
//
// orders/order_items/logs are NOT opened to "admins" - those stay
// superuser-only for now, except for the one custom route below.

// ---------------------------------------------------------------------
// POST /api/admin/articles
// Creates one article + all of its size/stock rows (article_items) in a
// single atomic request - the one thing the plain REST API can't do,
// since it spans two collections.
//
// Body:
// {
//   "article_number": "20143",       // required, must be unique (= sku)
//   "product_id": "New Product",     // groups color variants of one product
//   "name": "New Product",
//   "price": 100,
//   "cost_price": 90,                 // optional, internal only
//   "main_category": "velokleider",
//   "category": "men",
//   "color_name": "blue",
//   "color_code": "#0000FF",
//   "embed_3d": "",                   // optional HTML embed snippet
//   "just_stock": "no",               // 'yes' | 'no'
//   "return_category": "no",          // 'no' or e.g. 'shirt'
//   "description": "",
//   "notes": "",
//   "sort_order": 50,
//   "sizes": [
//     { "size": "S", "stock": 5 },
//     { "size": "M", "stock": 3 }
//   ]
// }
//
// Response: { ok: true, article: {...}, article_items: [...] }
//
// This route is JSON-only, so it can't carry uploaded image files in the
// same request. To attach images to a newly created article, follow up
// with a normal multipart PATCH to
// /api/collections/articles/records/{article.id} using the returned
// article.id - see 1783901500_articles_uploaded_images.js.
// ---------------------------------------------------------------------
routerAdd(
  "POST",
  "/api/admin/articles",
  (e) => {
    const body = e.requestInfo().body || {}

    const articleNumber = String(body.article_number || "").trim()
    if (!articleNumber) {
      throw new BadRequestError("article_number is required")
    }

    const name = body.name || body.product_id || ""
    if (!name) {
      throw new BadRequestError("name (or product_id) is required")
    }

    // reject duplicates up front with a clear error, instead of letting
    // the unique index throw a generic DB constraint error
    try {
      e.app.findFirstRecordByFilter("articles", "article_number = {:sku}", { sku: articleNumber })
      throw new BadRequestError("An article with article_number '" + articleNumber + "' already exists")
    } catch (err) {
      if (err instanceof BadRequestError) throw err
      // not found -> good, proceed
    }

    const sizes = Array.isArray(body.sizes) ? body.sizes : []

    let createdArticle
    const createdItems = []

    e.app.runInTransaction((txApp) => {
      const articlesCollection = txApp.findCollectionByNameOrId("articles")
      const article = new Record(articlesCollection)
      article.set("article_number", articleNumber)
      article.set("product_id", body.product_id || name)
      article.set("name", name)
      article.set("price", Number(body.price || 0))
      article.set("cost_price", Number(body.cost_price || 0))
      article.set("main_category", body.main_category || "")
      article.set("category", body.category || "")
      article.set("color_name", body.color_name || "")
      article.set("color_code", body.color_code || "")
      article.set("embed_3d", body.embed_3d || "")
      article.set("just_stock", body.just_stock || "no")
      article.set("return_category", body.return_category || "no")
      article.set("description", body.description || "")
      article.set("notes", body.notes || "")
      article.set("sort_order", Number(body.sort_order || 0))
      txApp.save(article)
      createdArticle = article

      const itemsCollection = txApp.findCollectionByNameOrId("article_items")
      for (const s of sizes) {
        if (!s || !s.size) continue
        const item = new Record(itemsCollection)
        item.set("article", article.id)
        item.set("size", String(s.size))
        item.set("stock", Number(s.stock || 0))
        txApp.save(item)
        createdItems.push(item)
      }
    })

    return e.json(200, {
      ok: true,
      article: createdArticle,
      article_items: createdItems,
    })
  },
  $apis.requireAuth("admins", "_superusers")
)

// ---------------------------------------------------------------------
// POST /api/admin/orders/{id}/cancel
// Cancels an order and, if it was actually paid via Zahls, refunds it
// through the Zahls API first - all in one request, so a failed refund
// aborts the whole thing instead of leaving an order marked cancelled
// with no money actually returned. This is the ONLY way to cancel an
// order now - a plain PATCH with {cancelled: true} to the orders
// collection is rejected by the onRecordUpdateRequest hook in
// veloclub.pb.js specifically to force every cancellation through here.
//
// Body:
// {
//   "note": "...",           // optional, staff's cancellation reason
//   "refundAmount": 51.00    // optional, CHF. Defaults to the order's full
//                             // amount_paid. Must be > 0 and <= amount_paid.
//                             // Ignored (nothing is refunded) for orders
//                             // that were never actually paid via Zahls -
//                             // legacy Excel imports and free/promo orders.
// }
//
// Response: { ok: true, order: {...}, refunded: <amount actually refunded, CHF> }
// ---------------------------------------------------------------------
routerAdd(
  "POST",
  "/api/admin/orders/{id}/cancel",
  (e) => {
    const zahls = require(`${__hooks}/lib_zahls.js`)

    const order = e.app.findRecordById("orders", e.request.pathValue("id"))
    if (order.get("cancelled") === true) {
      throw new BadRequestError("This order is already cancelled")
    }

    const body = e.requestInfo().body || {}
    const note = String(body.note || "")
    const amountPaid = Number(order.get("amount_paid") || 0)

    let refundAmount = amountPaid
    if (body.refundAmount !== undefined && body.refundAmount !== null && body.refundAmount !== "") {
      refundAmount = Number(body.refundAmount)
    }
    if (!isFinite(refundAmount) || refundAmount <= 0) {
      throw new BadRequestError("refundAmount must be greater than 0")
    }
    // small epsilon for float rounding (CHF stored/entered with cents)
    if (refundAmount > amountPaid + 0.005) {
      throw new BadRequestError("refundAmount cannot exceed the order's amount_paid (" + amountPaid + ")")
    }

    let actuallyRefunded = 0
    // Only real Zahls payments have anything to refund - legacy
    // (Excel-imported) and free (promo/return, amount 0) orders don't.
    if (order.get("payment_provider") === "zahls") {
      zahls.refundOrderViaZahls(order, refundAmount)
      actuallyRefunded = refundAmount
    }

    // Return stock: finalizeOrder() (lib_zahls.js) decrements article_items
    // .stock for every line when ANY order is placed, regardless of
    // payment_provider - so every cancelled order restocks here too, not
    // just refunded Zahls ones. The "already cancelled" guard above makes
    // this one-shot per order (can't double-restock by cancelling twice).
    const orderItems = e.app.findRecordsByFilter("order_items", "order = {:oid}", "", 0, 0, { oid: order.id })
    for (const item of orderItems) {
      let stockItem
      try {
        stockItem = e.app.findFirstRecordByFilter(
          "article_items",
          "article = {:aid} && size = {:size}",
          { aid: item.get("article"), size: item.get("size") },
        )
      } catch (err) {
        // That size's article_items row no longer exists (e.g. deleted
        // from the article since this order was placed) - nothing to
        // restock it to. Skip rather than fail the whole cancellation.
        continue
      }
      stockItem.set("stock", Number(stockItem.get("stock") || 0) + Number(item.get("quantity") || 0))
      e.app.save(stockItem)
    }

    order.set("cancelled", true)
    order.set("cancelled_note", note)
    order.set("cancelled_at", new Date().toISOString())
    e.app.save(order)

    const logsCollection = e.app.findCollectionByNameOrId("logs")
    const log = new Record(logsCollection)
    log.set("order", order.id)
    log.set("kind", "cancel")
    log.set(
      "note",
      actuallyRefunded > 0 ? note + " (rückerstattet: " + actuallyRefunded.toFixed(2) + " CHF)" : note,
    )
    log.set("admin_name", e.auth ? e.auth.get("name") || e.auth.get("email") : "")
    log.set("placed_at", new Date().toISOString())
    e.app.save(log)

    return e.json(200, { ok: true, order: order, refunded: actuallyRefunded })
  },
  $apis.requireAuth("admins", "_superusers")
)
