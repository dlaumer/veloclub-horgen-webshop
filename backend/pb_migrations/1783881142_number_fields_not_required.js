/// <reference path="../pb_data/types.d.ts" />
// Migration: several NumberFields were marked required: true, but
// PocketBase treats the value 0 as "empty" for required number fields -
// so anything legitimately zero (an out-of-stock size, a fully-discounted
// return-promo item, etc.) failed validation with "Cannot be blank."
//
// This makes the affected fields optional instead. The app already
// defaults missing numbers to 0 wherever it reads them (Number(x || 0)),
// so nothing downstream depends on these actually being "required".
//
// ADDITIVE on top of the previous migrations - alters existing collections
// in place, does not recreate them.

migrate((app) => {
  let articles = app.findCollectionByNameOrId("articles")
  articles.fields.getByName("price").required = false
  app.save(articles)

  let articleItems = app.findCollectionByNameOrId("article_items")
  articleItems.fields.getByName("stock").required = false
  app.save(articleItems)

  let orderItems = app.findCollectionByNameOrId("order_items")
  orderItems.fields.getByName("quantity").required = false
  orderItems.fields.getByName("unit_price").required = false
  orderItems.fields.getByName("price_paid").required = false
  app.save(orderItems)
}, (app) => {
  let articles = app.findCollectionByNameOrId("articles")
  articles.fields.getByName("price").required = true
  app.save(articles)

  let articleItems = app.findCollectionByNameOrId("article_items")
  articleItems.fields.getByName("stock").required = true
  app.save(articleItems)

  let orderItems = app.findCollectionByNameOrId("order_items")
  orderItems.fields.getByName("quantity").required = true
  orderItems.fields.getByName("unit_price").required = true
  orderItems.fields.getByName("price_paid").required = true
  app.save(orderItems)
})
