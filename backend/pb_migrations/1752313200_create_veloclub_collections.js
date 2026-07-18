/// <reference path="../pb_data/types.d.ts" />
// Migration: creates the base collections for the Veloclub webshop backend.
// Drop this file into pb_migrations/ next to your pocketbase binary.
// It is applied automatically the next time you run `./pocketbase serve`
// (or manually with `./pocketbase migrate up`).

migrate((app) => {
  // ---------------------------------------------------------------------
  // articles  (Lagerbestand)
  // One row per SKU / color variant - this is what the frontend calls
  // "colorId" and uses directly as the cart line's sku. Several rows
  // sharing the same product_id are the color variants of one product
  // (frontend groups them back into Product.colors[] at read time).
  // Public catalog data - readable by anyone (needed for the shop
  // frontend), editable only by superusers (via the admin dashboard).
  // ---------------------------------------------------------------------
  let articles = new Collection({
    type: "base",
    name: "articles",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "article_number", type: "text", required: true, max: 50 }, // = sku = frontend colorId
      { name: "product_id", type: "text", required: true, max: 50 }, // groups color variants of one product ("Gruppe")
      { name: "name", type: "text", required: true, max: 200 },
      { name: "price", type: "number", required: true }, // CHF
      // e.g. {"S": 10, "M": 5, "L": 0}
      { name: "stock_by_size", type: "json" },
      { name: "main_category", type: "text", max: 100 }, // "Rubrik", e.g. velokleider
      { name: "category", type: "text", max: 100 }, // e.g. men / women / kids
      { name: "color_name", type: "text", max: 100 },
      { name: "color_code", type: "text", max: 20 }, // hex swatch, e.g. "#ffffff"
      { name: "images", type: "file", maxSelect: 10, maxSize: 10485760 },
      { name: "embed_3d", type: "text" }, // HTML embed code (e.g. Sketchfab iframe), not a file
      { name: "just_stock", type: "text", max: 10 }, // 'yes' | 'no'
      { name: "return_category", type: "text", max: 50 }, // 'no' or a return category like 'shirt'
      { name: "description", type: "text" },
      { name: "notes", type: "text" }, // internal notes
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_articles_number ON articles (article_number)"],
  })
  app.save(articles)

  // ---------------------------------------------------------------------
  // orders  (Bestellungen - header, one row per order)
  // Superuser-only via the public API. Orders are only ever created
  // internally by the pb_hooks custom routes (after a confirmed Zahls
  // payment webhook, or a free/zero-total order) - never directly from
  // the browser. Staff manage orders via the admin dashboard.
  // ---------------------------------------------------------------------
  let orders = new Collection({
    type: "base",
    name: "orders",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "order_number", type: "text", max: 50 }, // = the orderId the Worker generates at /api/checkout time
      { name: "buyer_name", type: "text", required: true, max: 200 },
      { name: "buyer_lastname", type: "text", max: 200 },
      { name: "buyer_email", type: "email", required: true },
      { name: "kidzbike", type: "bool" },
      { name: "comments", type: "text" }, // free-text from checkout form
      { name: "promo_code", type: "text", max: 100 },
      { name: "payment_provider", type: "text", max: 50 }, // "zahls" | "free"
      { name: "payment_status", type: "text", max: 50 }, // e.g. "confirmed"
      { name: "amount_paid", type: "number" }, // CHF (not Rappen)
      { name: "currency", type: "text", max: 10 },
      { name: "provider_tx_id", type: "text", max: 100 }, // Zahls tx id/uuid, for reconciliation
      { name: "cancelled", type: "bool" },
      { name: "cancelled_at", type: "date" },
      { name: "cancelled_note", type: "text" },
      { name: "ready", type: "bool" }, // Bereitgestellt?
      { name: "picked_up", type: "bool" }, // Abgeholt?
      { name: "customer_note", type: "text" }, // Bemerkungen Kunde
      { name: "internal_note", type: "text" }, // Bemerkungen Intern
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_orders_number ON orders (order_number)"],
  })
  app.save(orders)

  // ---------------------------------------------------------------------
  // order_items  (line items: article + size + qty + price paid)
  // Same access model as orders: superuser-only, written by pb_hooks.
  // ---------------------------------------------------------------------
  let orderItems = new Collection({
    type: "base",
    name: "order_items",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "order",
        type: "relation",
        required: true,
        maxSelect: 1,
        collectionId: orders.id,
        cascadeDelete: true,
      },
      {
        name: "article",
        type: "relation",
        required: true,
        maxSelect: 1,
        collectionId: articles.id,
        cascadeDelete: false,
      },
      { name: "size", type: "text", max: 20 },
      { name: "color", type: "text", max: 100 },
      { name: "quantity", type: "number", required: true },
      { name: "unit_price", type: "number", required: true }, // full price before any return discount
      { name: "price_paid", type: "number", required: true }, // actually paid, incl. fees / minus return discount
      { name: "is_return", type: "bool" }, // Retoure?
      { name: "return_category", type: "text", max: 50 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  })
  app.save(orderItems)

  // ---------------------------------------------------------------------
  // logs  (audit trail per order - purchase / cancel / ready / pickup)
  // Only ever written by the hooks (see pb_hooks). Staff-only read.
  // ---------------------------------------------------------------------
  let logs = new Collection({
    type: "base",
    name: "logs",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "order",
        type: "relation",
        required: true,
        maxSelect: 1,
        collectionId: orders.id,
        cascadeDelete: true,
      },
      {
        name: "kind",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["purchase", "cancel", "ready", "pickup"],
      },
      { name: "note", type: "text" },
      { name: "created", type: "autodate", onCreate: true },
    ],
  })
  app.save(logs)
}, (app) => {
  // revert, in reverse dependency order
  ;["logs", "order_items", "orders", "articles"].forEach((name) => {
    try {
      app.delete(app.findCollectionByNameOrId(name))
    } catch (err) {
      // already gone, ignore
    }
  })
})
