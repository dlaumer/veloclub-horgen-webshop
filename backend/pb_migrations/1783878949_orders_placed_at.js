/// <reference path="../pb_data/types.d.ts" />
// Migration: adds "placed_at" to orders.
//
// ADDITIVE on top of the previous migrations - alters "orders" in place.
//
// PocketBase's "autodate" fields (like our existing "created"/"updated")
// always force the current server time on every write, even for superuser
// requests - there's no way to backdate them via the API. That's fine for
// orders created live through /api/webhook or /api/free-order, but it means
// the legacy Excel import (which has real historical order timestamps)
// can't preserve them in "created". "placed_at" is a plain (non-autodate)
// date field so the import script - and finalizeOrder() for real new
// orders - can set it explicitly to the real order time.

migrate((app) => {
  let orders = app.findCollectionByNameOrId("orders")
  orders.fields.add(new DateField({ name: "placed_at" }))
  app.save(orders)
}, (app) => {
  let orders = app.findCollectionByNameOrId("orders")
  orders.fields.removeByName("placed_at")
  app.save(orders)
})
