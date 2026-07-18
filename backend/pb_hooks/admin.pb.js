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
// orders/order_items/logs are NOT opened to "admins" - those stay
// superuser-only for now, since they're not part of this request.

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
//   "image_urls": ["https://.../img1.png"],
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
      article.set("image_urls", Array.isArray(body.image_urls) ? body.image_urls : [])
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
