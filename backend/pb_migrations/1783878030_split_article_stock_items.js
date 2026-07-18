/// <reference path="../pb_data/types.d.ts" />
// Migration: splits per-size stock out of "articles" into a new
// "article_items" collection (one row per article+size).
//
// This is an ADDITIVE migration on top of the already-applied
// 1752313200_create_veloclub_collections.js - it does NOT recreate
// "articles", it alters the existing collection in place. Never edit an
// already-applied migration file directly; PocketBase tracks applied
// migrations by filename in the internal _migrations table, so an edited
// file either gets silently skipped (if the filename is unchanged) or, if
// renamed, tries to re-run the original CREATE logic and fails because the
// collection already exists.

migrate((app) => {
  let articles = app.findCollectionByNameOrId("articles")
  articles.fields.removeByName("stock_by_size")
  articles.fields.removeByName("just_stock")
  app.save(articles)

  // ---------------------------------------------------------------------
  // article_items  (Lagerbestand pro Groesse)
  // One row per size of an article - this is where stock actually lives,
  // so staff can edit individual sizes as normal table rows in the admin
  // dashboard instead of hand-editing a JSON blob. "just_stock" lives here
  // too since the frontend tracks it per size, not per article.
  // Public read (frontend needs it to show stock/sizes), staff-only write.
  // ---------------------------------------------------------------------
  let articleItems = new Collection({
    type: "base",
    name: "article_items",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "article",
        type: "relation",
        required: true,
        maxSelect: 1,
        collectionId: articles.id,
        cascadeDelete: true,
      },
      { name: "size", type: "text", required: true, max: 20 },
      { name: "stock", type: "number", required: true },
      { name: "just_stock", type: "text", max: 10 }, // 'yes' | 'no'
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_article_items_article_size ON article_items (article, size)"],
  })
  app.save(articleItems)
}, (app) => {
  // revert: drop article_items, restore the two fields on articles
  try {
    app.delete(app.findCollectionByNameOrId("article_items"))
  } catch (err) {
    // already gone, ignore
  }

  let articles = app.findCollectionByNameOrId("articles")
  articles.fields.add(new JSONField({ name: "stock_by_size" }))
  articles.fields.add(new TextField({ name: "just_stock", max: 10 }))
  app.save(articles)
})
