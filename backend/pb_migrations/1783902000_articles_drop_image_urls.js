/// <reference path="../pb_data/types.d.ts" />
// Migration: removes "image_urls" from articles now that every article's
// photos live in the real "images" file field (see 1783901500_articles_
// uploaded_images.js and backend/scripts/migrate_images_to_files.mjs,
// which copied every image_urls entry over as an uploaded file). The
// storefront (/api/stock), the admin dashboard, and the order-confirmation
// email path have all been switched to read images/build URLs from the
// "images" field only - see veloclub.pb.js's articleImageUrls().
//
// ADDITIVE-STYLE cleanup migration on top of all previous migrations -
// only removes this one now-unused field from the existing "articles"
// collection.
//
// IMPORTANT: only run this after confirming (via the migration script's
// console output, or by spot-checking a few articles in the PocketBase
// dashboard) that every article's images were actually copied over -
// once this field is gone, any article that never got its images
// uploaded has no fallback and will show no photos at all.

migrate((app) => {
  let articles = app.findCollectionByNameOrId("articles")
  articles.fields.removeByName("image_urls")
  app.save(articles)
}, (app) => {
  let articles = app.findCollectionByNameOrId("articles")
  articles.fields.add(new JSONField({ name: "image_urls" }))
  app.save(articles)
})
