/// <reference path="../pb_data/types.d.ts" />
// Migration: adds "ready_undo" and "pickup_undo" to logs.kind, and closes
// the admin delete permission that used to exist on this collection.
//
// Undoing "ready"/"picked up" from the admin dashboard used to DELETE the
// matching log entry (see 1783904000_logs_admin_delete_rule.js) so the
// activity log wouldn't keep showing a stale "marked ready" event. That's
// being replaced: undoing now creates a new "ready_undo"/"pickup_undo" log
// entry instead (written by the onRecordUpdateRequest hook in
// pb_hooks/veloclub.pb.js, same place "ready"/"pickup" entries are written)
// so the log stays a complete, un-erasable history of what actually
// happened - including corrections - rather than having entries vanish.
// Since nothing should delete log entries anymore, deleteRule goes back to
// null (superuser-only).
//
// ADDITIVE on top of all previous migrations - only touches the "kind"
// field's allowed values and the delete rule on the already-existing
// "logs" collection.

migrate(
  (app) => {
    let logs = app.findCollectionByNameOrId("logs")

    let kind = logs.fields.getByName("kind")
    kind.values = ["purchase", "cancel", "ready", "pickup", "ready_undo", "pickup_undo"]

    logs.deleteRule = null

    app.save(logs)
  },
  (app) => {
    let logs = app.findCollectionByNameOrId("logs")

    let kind = logs.fields.getByName("kind")
    kind.values = ["purchase", "cancel", "ready", "pickup"]

    logs.deleteRule = "@request.auth.collectionName = 'admins' && (kind = 'ready' || kind = 'pickup')"

    app.save(logs)
  },
)
