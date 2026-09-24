/// <reference path="../pb_data/types.d.ts" />
// Migration: creates the "promo_codes" collection, managed from the admin
// dashboard (see src/components/admin/PromoCodesModal.tsx), and used
// server-side (pb_hooks/lib_zahls.js's resolvePromoCode/computeCartPricing)
// to authoritatively decide checkout discounts - NOT trusted from the
// client anymore (see the comment block at the top of lib_zahls.js for the
// full story of what this replaces).
//
// Three types, matching the three discount behaviours the shop supports:
//   "return_category" - within the cart, the single cheapest item in each
//                        distinct return_category gets one unit free.
//   "percentage"       - the whole order is discounted by `percentage` %.
//   "free_order"       - the whole order is free (100% discount).
// `percentage` is only meaningful (and required, enforced in the admin
// dashboard UI, not the schema) for the "percentage" type.
//
// `code` is stored UPPERCASE (the admin form + resolvePromoCode both
// normalize to uppercase before ever touching this table), so the unique
// index below is a plain case-sensitive index and still behaves as a
// case-insensitive uniqueness guarantee in practice.
//
// Access: admins-only for everything, including list/view - customers
// never talk to this collection directly. Checkout validates a typed code
// through the public GET /api/promo-code route (see veloclub.pb.js), which
// looks this collection up server-side via e.app.findFirstRecordByFilter
// (bypasses these API rules entirely, same as orders/logs already do) and
// only ever returns {valid, type, percentage} - never the full record list.

migrate(
  (app) => {
    const adminRule = "@request.auth.collectionName = 'admins'"

    let promoCodes = new Collection({
      type: "base",
      name: "promo_codes",
      listRule: adminRule,
      viewRule: adminRule,
      createRule: adminRule,
      updateRule: adminRule,
      deleteRule: adminRule,
      fields: [
        { name: "code", type: "text", required: true, max: 100 },
        {
          name: "type",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["return_category", "percentage", "free_order"],
        },
        { name: "percentage", type: "number", min: 0, max: 100 },
        { name: "active", type: "bool" },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_promo_codes_code ON promo_codes (code)"],
    })
    app.save(promoCodes)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("promo_codes"))
    } catch (err) {
      // already gone, ignore
    }
  },
)
