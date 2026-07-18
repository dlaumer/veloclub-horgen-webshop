/// <reference path="../pb_data/types.d.ts" />
// Migration: adds "placed_at" to logs, same reasoning as orders.placed_at
// (see 1783878949_orders_placed_at.js) - logs.created is an autodate field
// and always forces the current server time, even for superuser requests,
// so it can't hold the real historical date for a legacy-imported
// "purchase" log entry. "placed_at" is a plain (non-autodate) date field:
//   - for legacy imports: set to the order's real historical timestamp
//   - for "purchase" logs on real new orders: set to the same value as
//     the order's own placed_at
//   - for "cancel"/"ready"/"pickup" logs (written when staff toggles a
//     flag on an existing order): set to the current time, since that's
//     genuinely when that action happened
//
// ADDITIVE on top of the previous migrations - alters "logs" in place.

migrate((app) => {
  let logs = app.findCollectionByNameOrId("logs")
  logs.fields.add(new DateField({ name: "placed_at" }))
  app.save(logs)
}, (app) => {
  let logs = app.findCollectionByNameOrId("logs")
  logs.fields.removeByName("placed_at")
  app.save(logs)
})
