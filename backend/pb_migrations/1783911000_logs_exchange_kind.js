/// <reference path="../pb_data/types.d.ts" />
// Migration: adds "exchange" to logs.kind - written by the new
// POST /api/admin/orders/{id}/items/{itemId}/exchange route (admin.pb.js)
// whenever staff swap an order line to a different size of the SAME
// article (same price - only the size changes). Same additive pattern as
// 1783905000_logs_undo_kinds.js.

migrate(
  (app) => {
    let logs = app.findCollectionByNameOrId("logs")

    let kind = logs.fields.getByName("kind")
    kind.values = ["purchase", "cancel", "ready", "pickup", "ready_undo", "pickup_undo", "exchange"]

    app.save(logs)
  },
  (app) => {
    let logs = app.findCollectionByNameOrId("logs")

    let kind = logs.fields.getByName("kind")
    kind.values = ["purchase", "cancel", "ready", "pickup", "ready_undo", "pickup_undo"]

    app.save(logs)
  },
)
