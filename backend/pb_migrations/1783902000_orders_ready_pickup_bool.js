/// <reference path="../pb_data/types.d.ts" />
// Migration: changes orders.ready and orders.picked_up from tri-state text
// ("" unknown | "yes" | "no", see 1783900500_orders_ready_pickup_tristate.js)
// back to plain bool.
//
// The "unknown" state turned out not to be worth the complexity: an order
// with no timestamped log entry isn't actually ambiguous - it WAS picked up,
// we just don't have a record of exactly when (usually because it was
// hand-edited in the PocketBase admin UI or came from the legacy Excel
// import, both of which bypass the app's own log-writing hook). So blank/
// unknown values are resolved to true here instead of staying ambiguous.
//
// Data rule applied below, per field, independently of the other:
//   "no" / "false" / "0"  -> false  (explicit, real signal - kept as-is)
//   anything else          -> true   (covers "yes", "true", "1", any other
//                                      legacy junk, AND blank/unknown - we
//                                      now treat "no timestamp" as "done,
//                                      just undated" rather than "not done")
//
// PocketBase field types can't be changed in-place, so this removes+re-adds
// the fields under the same names, which would normally drop whatever is
// still in the column at that point. To avoid losing data, every order's
// current text value is snapshotted into memory BEFORE the field swap, then
// re-applied as a real boolean via the Record API AFTER the swap.
//
// Matching updates made alongside this migration (not part of the schema
// change itself, but required for the app to keep working):
//   - pb_hooks/veloclub.pb.js: onRecordUpdateRequest transition checks now
//     compare against boolean `true` instead of the string "yes".
//   - pb_hooks/lib_zahls.js: finalizeOrder now sets real `false` instead of
//     the string "no" for brand new orders.
//   - src/pages/AdminDashboard.tsx: handleMarkReady/handleMarkPicked now
//     PATCH `true` instead of `"yes"`.

migrate((app) => {
  let orders = app.findCollectionByNameOrId("orders")

  function isFalse(raw) {
    let s = String(raw || "").trim().toLowerCase()
    return s === "no" || s === "false" || s === "0"
  }

  // 1. Snapshot every order's current tri-state text value before the
  //    column type changes below - once the fields are swapped, the raw
  //    text is gone.
  let records = app.findAllRecords("orders")
  let snapshot = {}
  for (let record of records) {
    snapshot[record.id] = {
      ready: record.get("ready"),
      picked_up: record.get("picked_up"),
    }
  }

  // 2. Swap field type text -> bool.
  orders.fields.removeByName("ready")
  orders.fields.removeByName("picked_up")
  orders.fields.add(new BoolField({ name: "ready" }))
  orders.fields.add(new BoolField({ name: "picked_up" }))
  app.save(orders)

  // 3. Re-apply values as real booleans, using the snapshot from step 1.
  for (let record of records) {
    let raw = snapshot[record.id]
    record.set("ready", !isFalse(raw.ready))
    record.set("picked_up", !isFalse(raw.picked_up))
    app.save(record)
  }
}, (app) => {
  // Down: revert to tri-state text. There's no way to recover which records
  // were originally "" (unknown) vs "yes" - they all just become "yes".
  let orders = app.findCollectionByNameOrId("orders")

  let records = app.findAllRecords("orders")
  let snapshot = {}
  for (let record of records) {
    snapshot[record.id] = {
      ready: !!record.get("ready"),
      picked_up: !!record.get("picked_up"),
    }
  }

  orders.fields.removeByName("ready")
  orders.fields.removeByName("picked_up")
  orders.fields.add(new TextField({ name: "ready", max: 10 }))
  orders.fields.add(new TextField({ name: "picked_up", max: 10 }))
  app.save(orders)

  for (let record of records) {
    let raw = snapshot[record.id]
    record.set("ready", raw.ready ? "yes" : "no")
    record.set("picked_up", raw.picked_up ? "yes" : "no")
    app.save(record)
  }
})
