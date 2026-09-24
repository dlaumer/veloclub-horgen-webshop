/// <reference path="../pb_data/types.d.ts" />
// Migration: adds "provider_fee" to orders - the actual CHF fee Zahls/
// Payrexx charged for that transaction.
//
// Until now the only fee handling was the *estimate* baked into the
// selling price (see calcPriceFromCost in ArticleModal.tsx: price is set
// so that, after a CHF 0.30 + 2.9% fee, the club nets the cost price back).
// That's a prediction made at pricing time, not what actually got charged -
// this field is the real number, straight from the payment webhook, for
// reconciliation/bookkeeping.
//
// The Zahls webhook's transaction object carries this as "fee" (confirmed
// from a live webhook payload - Zahls is set up as a Payrexx platform
// merchant, which uses that key instead of the ordinary "payrexxFee";
// https://docs.payrexx.com/developer/guides/webhook/transaction lists both).
// pb_hooks/veloclub.pb.js's webhook handler now reads tx.fee (falling back
// to tx.payrexxFee) and pb_hooks/lib_zahls.js's finalizeOrder stores it
// here, in CHF, same unit as amount_paid. Free orders (paymentProvider
// "free") never set this - it stays at the field default (0), correctly
// meaning "no fee was charged" rather than "unknown".
//
// ADDITIVE on top of all previous migrations - alters "orders" in place.

migrate((app) => {
  let orders = app.findCollectionByNameOrId("orders")
  orders.fields.add(new NumberField({ name: "provider_fee" }))
  app.save(orders)
}, (app) => {
  let orders = app.findCollectionByNameOrId("orders")
  orders.fields.removeByName("provider_fee")
  app.save(orders)
})
