/// <reference path="../pb_data/types.d.ts" />
// Migration: creates an "admins" auth collection for staff who manage the
// catalog through the future admin dashboard (adding/editing/deleting
// articles) without needing full PocketBase superuser access.
//
// ADDITIVE on top of all previous migrations - only creates this one new
// collection, does not touch anything else. Superuser accounts keep
// working everywhere (they always bypass API rules); this just adds a
// second, more restricted way to authenticate for catalog-management
// requests.
//
// Staff accounts are NOT self-service: listRule/viewRule/createRule/
// updateRule/deleteRule are all superuser-only, so you (as superuser)
// create/remove staff logins by hand in Dashboard > Collections > admins
// > New record, the same way you'd manage any other collection's rows.
// The dashboard's login page then calls PocketBase's built-in
//   POST /api/collections/admins/auth-with-password
//   { "identity": "staff@example.com", "password": "..." }
// which works automatically for any auth-type collection, no custom
// route needed.

migrate((app) => {
  let admins = new Collection({
    type: "auth",
    name: "admins",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    authRule: "", // any admins record with the correct email+password may log in
    fields: [
      { name: "name", type: "text", max: 200 }, // display name, e.g. for the dashboard header
    ],
    passwordAuth: {
      enabled: true,
      identityFields: ["email"],
    },
  })
  app.save(admins)
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("admins"))
  } catch (err) {
    // already gone, ignore
  }
})
