/// <reference path="../pb_data/types.d.ts" />
// Migration: lets authenticated "admins" (not just superusers) read
// orders/order_items/logs, and update orders - this is what powers the
// admin dashboard's orders list, order detail modal, activity log panel,
// and the "mark ready" / "mark picked up" / "cancel order" actions.
//
// ADDITIVE on top of all previous migrations - only changes the access
// rules on three already-existing collections.
//
// "@request.auth.collectionName = 'admins'" matches any request
// authenticated with a token from the admins collection (see
// 1783900000_create_admins_collection.js). Superusers are unaffected and
// keep full access regardless of this rule. Plain/unauthenticated requests
// (i.e. normal shop customers) still get denied, since @request.auth is
// empty for them.
//
// orders.updateRule is opened fully (not restricted to specific fields -
// PocketBase rules are record-level, not field-level) so the dashboard can
// PATCH ready/picked_up/cancelled/cancelled_note/internal_note. The
// existing onRecordUpdateRequest hook in veloclub.pb.js already writes the
// matching "ready"/"pickup"/"cancel" log entries whenever those flags flip,
// so admin edits get the same audit trail as the automated flow.
//
// order_items and logs stay read-only for admins (createRule/updateRule/
// deleteRule remain null / superuser-only) - both are only ever written by
// the hooks (finalizeOrder / the update hook), never edited directly.

migrate((app) => {
  const adminRule = "@request.auth.collectionName = 'admins'"

  let orders = app.findCollectionByNameOrId("orders")
  orders.listRule = adminRule
  orders.viewRule = adminRule
  orders.updateRule = adminRule
  app.save(orders)

  let orderItems = app.findCollectionByNameOrId("order_items")
  orderItems.listRule = adminRule
  orderItems.viewRule = adminRule
  app.save(orderItems)

  let logs = app.findCollectionByNameOrId("logs")
  logs.listRule = adminRule
  logs.viewRule = adminRule
  app.save(logs)
}, (app) => {
  let orders = app.findCollectionByNameOrId("orders")
  orders.listRule = null
  orders.viewRule = null
  orders.updateRule = null
  app.save(orders)

  let orderItems = app.findCollectionByNameOrId("order_items")
  orderItems.listRule = null
  orderItems.viewRule = null
  app.save(orderItems)

  let logs = app.findCollectionByNameOrId("logs")
  logs.listRule = null
  logs.viewRule = null
  app.save(logs)
})
