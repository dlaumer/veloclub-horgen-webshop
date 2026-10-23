/// <reference path="../pb_data/types.d.ts" />
// Migration: per-item "ready" / "picked_up" flags on order_items, so staff
// can hand out (or prepare) just PART of an order. orders.ready /
// orders.picked_up stay as the whole-order status and are kept in sync with
// the items by the code that changes either side (see admin.pb.js's
// POST /api/admin/orders/{id}/items/{itemId}/status route and the
// onRecordUpdateRequest hook in veloclub.pb.js).
//
// Backfill: every existing item inherits its order's current ready /
// picked_up value, so nothing suddenly looks "not ready" after deploying.
// Also adds the "item_*" kinds to logs.kind so partial actions show up in
// the activity log without being mistaken for whole-order events.

migrate(
  (app) => {
    let items = app.findCollectionByNameOrId("order_items")
    items.fields.add(new BoolField({ name: "ready" }))
    items.fields.add(new BoolField({ name: "picked_up" }))
    app.save(items)

    // Backfill from the parent order.
    let orders = app.findAllRecords("orders")
    for (let order of orders) {
      let ready = order.get("ready") === true
      let pickedUp = order.get("picked_up") === true
      if (!ready && !pickedUp) continue
      let orderItems = app.findRecordsByFilter("order_items", "order = {:oid}", "", 0, 0, { oid: order.id })
      for (let item of orderItems) {
        item.set("ready", ready)
        item.set("picked_up", pickedUp)
        app.save(item)
      }
    }

    let logs = app.findCollectionByNameOrId("logs")
    let kind = logs.fields.getByName("kind")
    kind.values = [
      "purchase",
      "cancel",
      "ready",
      "pickup",
      "ready_undo",
      "pickup_undo",
      "exchange",
      "item_ready",
      "item_pickup",
      "item_ready_undo",
      "item_pickup_undo",
    ]
    app.save(logs)
  },
  (app) => {
    let logs = app.findCollectionByNameOrId("logs")
    let kind = logs.fields.getByName("kind")
    kind.values = ["purchase", "cancel", "ready", "pickup", "ready_undo", "pickup_undo", "exchange"]
    app.save(logs)

    let items = app.findCollectionByNameOrId("order_items")
    items.fields.removeByName("ready")
    items.fields.removeByName("picked_up")
    app.save(items)
  },
)
