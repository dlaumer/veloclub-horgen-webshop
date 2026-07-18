/// <reference path="../pb_data/types.d.ts" />
// Migration: schema adjustments discovered while prepping the legacy Excel
// import (Lagerbestand/Bestellungen sheet).
//
// ADDITIVE on top of 1752313200_create_veloclub_collections.js and
// 1783878030_split_article_stock_items.js - alters the existing "articles"
// and "article_items" collections in place, does not recreate them.
//
// Changes:
//   - "just_stock" moves back onto "articles" (the sheet has one value per
//     article/color row, not per size - it was wrongly split onto
//     article_items in the previous migration).
//   - "images" (FileField) is replaced with "image_urls" (JSON array of
//     strings) - the legacy data stores external image URLs
//     (webshop-veloclubhorgen.ch/images/...), not files to upload.
//   - "cost_price" (Preis Thoemus - wholesale/cost price) and "sort_order"
//     (Pos. - manual display order) are new, both optional.

migrate((app) => {
  let articles = app.findCollectionByNameOrId("articles")

  articles.fields.removeByName("images")

  articles.fields.add(new JSONField({ name: "image_urls" }))
  articles.fields.add(new TextField({ name: "just_stock", max: 10 })) // 'yes' | 'no'
  articles.fields.add(new NumberField({ name: "cost_price" })) // CHF, wholesale/cost price, internal only
  articles.fields.add(new NumberField({ name: "sort_order" })) // lower = shown first

  app.save(articles)

  let articleItems = app.findCollectionByNameOrId("article_items")
  articleItems.fields.removeByName("just_stock")
  app.save(articleItems)
}, (app) => {
  let articles = app.findCollectionByNameOrId("articles")
  articles.fields.removeByName("image_urls")
  articles.fields.removeByName("just_stock")
  articles.fields.removeByName("cost_price")
  articles.fields.removeByName("sort_order")
  articles.fields.add(new FileField({ name: "images", maxSelect: 10, maxSize: 10485760 }))
  app.save(articles)

  let articleItems = app.findCollectionByNameOrId("article_items")
  articleItems.fields.add(new TextField({ name: "just_stock", max: 10 }))
  app.save(articleItems)
})
