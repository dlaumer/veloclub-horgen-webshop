/// <reference path="../pb_data/types.d.ts" />
// Migration: logs.item_id - which order_items row a per-item log entry
// ("item_ready" / "item_pickup" and their undos, see
// 1783912000_order_items_ready_pickup.js) is about, so the dashboard can show
// each item's own ready / picked-up time + admin under that item. Plain text
// (not a relation) on purpose: logs are an append-only history and must
// survive an item being deleted.

migrate(
  (app) => {
    let logs = app.findCollectionByNameOrId("logs")
    logs.fields.add(new TextField({ name: "item_id", max: 50 }))
    app.save(logs)
  },
  (app) => {
    let logs = app.findCollectionByNameOrId("logs")
    logs.fields.removeByName("item_id")
    app.save(logs)
  },
)
