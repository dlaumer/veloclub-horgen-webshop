/// <reference path="../pb_data/types.d.ts" />
// Migration: marks every legacy order (payment_provider = "legacy", i.e.
// imported from the old Excel sheet via backend/scripts/import_legacy_xlsx.py
// or sync_legacy_xlsx.py) as ready=true and picked_up=true.
//
// These are historical orders that were already fulfilled years ago in the
// old Excel/Apps-Script system - they were just never marked ready/picked up
// in THIS dashboard, so they show up as outstanding even though there's
// nothing left to do for them. (Orders created after 1783902000_orders_
// ready_pickup_bool.js switched these fields to real bools default to
// false, since the import scripts send "" which a BoolField coerces to
// false - earlier legacy orders, imported before that migration, already
// got resolved to true by its "unknown -> true" backfill logic at the time,
// so this only actually changes the newer batch.)
//
// Done directly via app.save() in a migration, NOT a PATCH through the
// dashboard/API, on purpose: the orders' onRecordUpdateRequest hook (see
// pb_hooks/veloclub.pb.js) sends a "ready"/"picked up" email to the customer
// and writes a new log entry on exactly this false->true transition -
// neither makes sense for an order that was actually completed years ago.
// A migration's app.save() never goes through that HTTP-request-bound hook
// (it only fires for the actual REST update route), so this updates the two
// flags silently: no emails sent, no new log entries written.
//
// Only touches orders with payment_provider = "legacy" - real orders placed
// through Zahls are left completely alone.

migrate(
  (app) => {
    let records = app.findAllRecords("orders")
    let n = 0
    for (let record of records) {
      if (record.get("payment_provider") !== "legacy") continue
      if (record.get("ready") === true && record.get("picked_up") === true) continue
      record.set("ready", true)
      record.set("picked_up", true)
      app.save(record)
      n++
    }
    console.log(`orders_legacy_fulfilled: updated ${n} legacy order(s) to ready=true, picked_up=true`)
  },
  (_app) => {
    // No-op: we don't know which of these were already true/false before
    // this migration ran (some legitimately, from the earlier tri-state
    // backfill), so there's nothing meaningful to revert to.
  },
)
