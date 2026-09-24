/// <reference path="../pb_data/types.d.ts" />
// Migration: adds "sort_order" to article_items, so staff can control the
// display order of an article's sizes - both in the admin dashboard's size
// editor (drag handle / arrows) and on the storefront's size picker -
// instead of it always being alphabetical ("L" < "M" < "S" < "XL" < "XS" <
// "XXL" sorts wrong for clothing sizes).
//
// Existing rows are backfilled with their current alphabetical position
// (per article) so nothing visually jumps around until someone actually
// reorders a size in the dashboard.
//
// Matching updates made alongside this migration:
//   - pb_hooks/veloclub.pb.js: /api/stock's toColor() now sorts an
//     article's items by sort_order before building the sizes array.
//   - src/lib/adminApi.ts: ArticleItemRecord gained sort_order,
//     listArticleItemsForArticle now sorts by it instead of by size, and
//     updateArticleItem/createArticleItem accept it.
//   - src/components/admin/ArticleModal.tsx: the size editor can reorder
//     rows (drag handle + up/down arrows), and save() writes each item's
//     current position as its sort_order.
//
// ADDITIVE on top of all previous migrations - alters "article_items" in
// place.

migrate((app) => {
  let articleItems = app.findCollectionByNameOrId("article_items")
  articleItems.fields.add(new NumberField({ name: "sort_order" }))
  app.save(articleItems)

  const byArticle = {}
  for (const it of app.findAllRecords("article_items")) {
    const aid = it.get("article")
    if (!byArticle[aid]) byArticle[aid] = []
    byArticle[aid].push(it)
  }
  for (const aid in byArticle) {
    const items = byArticle[aid]
    items.sort((a, b) => String(a.get("size")).localeCompare(String(b.get("size"))))
    items.forEach((it, i) => {
      it.set("sort_order", i)
      app.save(it)
    })
  }
}, (app) => {
  let articleItems = app.findCollectionByNameOrId("article_items")
  articleItems.fields.removeByName("sort_order")
  app.save(articleItems)
})
