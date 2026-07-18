/// <reference path="../pb_data/types.d.ts" />
// Migration: lets authenticated "admins" (not just superusers) create,
// update and delete articles + article_items - this is what powers the
// future dashboard's "add/edit/delete article" actions.
//
// ADDITIVE on top of all previous migrations - only changes the write
// rules on two already-existing collections.
//
// "@request.auth.collectionName = 'admins'" matches any request
// authenticated with a token from the admins collection (see
// 1783900000_create_admins_collection.js). Superusers are unaffected and
// keep full access regardless of this rule, since superuser tokens always
// bypass API rules entirely. Plain/unauthenticated requests (i.e. normal
// shop customers) still get denied, since @request.auth is empty for them.
//
// Note deleting an article is still safe: article_items has
// cascadeDelete: true on its relation to articles (so its size/stock rows
// get cleaned up automatically), while order_items' relation to articles
// has cascadeDelete: false and is required - so PocketBase will refuse to
// delete an article that's still referenced by historical order_items,
// protecting past orders from being broken by a catalog cleanup.

migrate((app) => {
  const adminRule = "@request.auth.collectionName = 'admins'"

  let articles = app.findCollectionByNameOrId("articles")
  articles.createRule = adminRule
  articles.updateRule = adminRule
  articles.deleteRule = adminRule
  app.save(articles)

  let articleItems = app.findCollectionByNameOrId("article_items")
  articleItems.createRule = adminRule
  articleItems.updateRule = adminRule
  articleItems.deleteRule = adminRule
  app.save(articleItems)
}, (app) => {
  let articles = app.findCollectionByNameOrId("articles")
  articles.createRule = null
  articles.updateRule = null
  articles.deleteRule = null
  app.save(articles)

  let articleItems = app.findCollectionByNameOrId("article_items")
  articleItems.createRule = null
  articleItems.updateRule = null
  articleItems.deleteRule = null
  app.save(articleItems)
})
