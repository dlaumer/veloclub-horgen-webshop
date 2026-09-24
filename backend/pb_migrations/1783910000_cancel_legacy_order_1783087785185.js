/// <reference path="../pb_data/types.d.ts" />
// One-off data fix: order_number "1783087785185" (Mattis Schwarz, Thömus SS
// Jersey Team Pro Kids, size 10/11 Jahre, free via promo code) was cancelled
// manually outside the app - staff note from the legacy sheet:
//   "Markus Blessing hat die Bestellung storniert, da zweimal kostenlos ein
//    SS Jersey Team Pro Kids bestellt wurde."
// (ordered twice for free by mistake, so the duplicate was cancelled). It
// was never marked cancelled in PocketBase, so the dashboard still shows it
// as active.
//
// Done directly via app.save() in a migration, NOT a PATCH through the
// dashboard/API, on purpose: the orders' onRecordUpdateRequest hook (see
// pb_hooks/veloclub.pb.js) rejects a direct {cancelled: true} PATCH to force
// cancellation through the refund-aware POST /api/admin/orders/{id}/cancel
// route instead - but that route always stamps cancelled_at as "now" and
// this order needs a HISTORICAL cancelled_at (same as its own placed_at, at
// the requester's request, since the exact cancellation time isn't known).
// It's also a real "legacy"/free order (price 0, no Zahls payment), so there
// was never anything to refund - a migration's silent app.save() (skipping
// the hook entirely) is the right tool here, matching the pattern already
// used by 1783906000_orders_legacy_fulfilled.js for similar legacy-data
// corrections.
//
// ADDITIVE data fix on top of all previous migrations - alters one existing
// "orders" record in place. No down migration: we don't know what state
// (cancelled or not) to revert to, and there's nothing schema-related to
// undo.

migrate((app) => {
  let order
  try {
    order = app.findFirstRecordByFilter("orders", "order_number = {:on}", { on: "1783087785185" })
  } catch (err) {
    console.log("cancel_legacy_order_1783087785185: order not found, skipping (already fixed or wrong id?)")
    return
  }

  if (order.get("cancelled") === true) {
    console.log("cancel_legacy_order_1783087785185: already cancelled, skipping")
    return
  }

  order.set("cancelled", true)
  // Exact cancellation time isn't known - use the order's own placed_at, as
  // requested.
  order.set("cancelled_at", order.get("placed_at"))
  order.set(
    "cancelled_note",
    "Markus Blessing hat die Bestellung storniert, da zweimal kostenlos ein SS Jersey Team Pro Kids bestellt wurde.",
  )
  app.save(order)
  console.log("cancel_legacy_order_1783087785185: marked order 1783087785185 as cancelled")
}, (_app) => {
  // No-op: intentionally no rollback (see comment above).
})
