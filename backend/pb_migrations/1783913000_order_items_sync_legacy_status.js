/// <reference path="../pb_data/types.d.ts" />
// Migration: idempotent re-sync of per-item ready / picked_up from the
// parent order, for legacy/imported data. 1783912000_order_items_ready_
// pickup.js already backfilled once when it ran; this one makes sure no
// legacy order is left with items that disagree with it (e.g. if that
// migration had already run before some data was imported/fixed).
//
// Rules, per order:
//   order.picked_up = true -> every item picked_up = true AND ready = true
//                             (something handed over was necessarily ready)
//   order.ready     = true -> every item ready = true
// It only ever sets flags to true, never clears one, so it can't undo
// per-item progress on orders that are only partially done.

migrate(
  (app) => {
    let orders = app.findAllRecords("orders")
    for (let order of orders) {
      let ready = order.get("ready") === true
      let pickedUp = order.get("picked_up") === true
      if (!ready && !pickedUp) continue

      let items = app.findRecordsByFilter("order_items", "order = {:oid}", "", 0, 0, { oid: order.id })
      for (let item of items) {
        let changed = false
        if ((ready || pickedUp) && item.get("ready") !== true) {
          item.set("ready", true)
          changed = true
        }
        if (pickedUp && item.get("picked_up") !== true) {
          item.set("picked_up", true)
          changed = true
        }
        if (changed) app.save(item)
      }
    }
  },
  (app) => {
    // Data-only sync; nothing to revert.
  },
)
