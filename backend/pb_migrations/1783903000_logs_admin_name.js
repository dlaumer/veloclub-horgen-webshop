/// <reference path="../pb_data/types.d.ts" />
// Migration: adds "admin_name" to logs - records which staff member
// performed a cancel/ready/pickup action (written by the
// onRecordUpdateRequest hook in pb_hooks/veloclub.pb.js, the only place
// logs get created for those three kinds).
//
// Denormalized as plain text (the admin's "name" field, falling back to
// their email) rather than a relation to the "admins" collection, because:
//   - the admins collection's read rules are deliberately superuser-only
//     (see 1783900000_create_admins_collection.js) - loosening them just so
//     the dashboard could expand/display a name isn't worth it
//   - a plain text snapshot stays an accurate historical record even if
//     that admin account is later renamed or removed
//
// Blank for logs written without an authenticated admin request - e.g. the
// "purchase" log created by the Zahls payment webhook.
//
// ADDITIVE on top of all previous migrations - alters "logs" in place.

migrate((app) => {
  let logs = app.findCollectionByNameOrId("logs")
  logs.fields.add(new TextField({ name: "admin_name", max: 200 }))
  app.save(logs)
}, (app) => {
  let logs = app.findCollectionByNameOrId("logs")
  logs.fields.removeByName("admin_name")
  app.save(logs)
})
