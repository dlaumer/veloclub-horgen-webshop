/// <reference path="../pb_data/types.d.ts" />
// Migration: lets authenticated "admins" delete "ready"/"pickup" log
// entries - this is what powers the admin dashboard's "undo" button next to
// the Bereit/Abgeholt badges in the order detail modal (toggling ready/
// picked_up back to false alone would leave a stale log entry, and the
// enrichment in AdminDashboard.tsx that derives readyAt/readyBy/pickedAt/
// pickedBy from the logs collection would keep showing the old timestamp).
//
// Scoped to kind = "ready" or "pickup" only - "purchase" and "cancel" log
// entries stay undeletable (deleteRule falls through to the default
// superuser-only null there is no per-kind rule, so we can't literally use
// null for those two; instead the rule below explicitly excludes them) since
// those are the actual audit trail for money changing hands and shouldn't
// be erasable from the dashboard.
//
// ADDITIVE on top of all previous migrations - only changes the delete rule
// on the already-existing "logs" collection.

migrate((app) => {
  let logs = app.findCollectionByNameOrId("logs")
  logs.deleteRule = "@request.auth.collectionName = 'admins' && (kind = 'ready' || kind = 'pickup')"
  app.save(logs)
}, (app) => {
  let logs = app.findCollectionByNameOrId("logs")
  logs.deleteRule = null
  app.save(logs)
})
