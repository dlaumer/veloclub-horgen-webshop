/// <reference path="../pb_data/types.d.ts" />
// Migration: changes orders.ready and orders.picked_up from bool to text
// with three states instead of two:
//   ""    = unknown (legacy imported order, we have no real record of this)
//   "yes"
//   "no"
//
// A plain bool can't represent "unknown" - it's always true or false, so
// every legacy-imported order was indistinguishable from a brand new order
// that's genuinely confirmed "not ready yet" / "not picked up yet". This
// lets the dashboard show legacy orders differently (e.g. "unknown" badge)
// instead of implying they were checked and found not-ready.
//
// ADDITIVE on top of all previous migrations - alters two fields on the
// existing "orders" collection in place (PocketBase field types can't be
// changed in-place, so this removes+re-adds them under the same names).
//
// NOTE: this changes semantics for pb_hooks too - see the matching updates
// in veloclub.pb.js (onRecordUpdateRequest transition checks now compare
// against the string "yes" instead of a bare truthy bool) and
// lib_zahls.js's finalizeOrder (which now explicitly sets "no"/"no" for
// brand new orders, since that's a genuinely known fact, unlike legacy
// imports).

migrate((app) => {
  let orders = app.findCollectionByNameOrId("orders")

  orders.fields.removeByName("ready")
  orders.fields.removeByName("picked_up")

  orders.fields.add(new TextField({ name: "ready", max: 10 }))
  orders.fields.add(new TextField({ name: "picked_up", max: 10 }))

  app.save(orders)
}, (app) => {
  let orders = app.findCollectionByNameOrId("orders")

  orders.fields.removeByName("ready")
  orders.fields.removeByName("picked_up")

  orders.fields.add(new BoolField({ name: "ready" }))
  orders.fields.add(new BoolField({ name: "picked_up" }))

  app.save(orders)
})
