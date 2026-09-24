/// <reference path="../pb_data/types.d.ts" />
// Migration: adds a real multi-file "images" field back onto articles, so
// product photos can be uploaded and stored/served by PocketBase itself
// instead of only referencing external URLs.
//
// ADDITIVE on top of all previous migrations - only adds a field, does not
// touch/remove "image_urls" (that stays as a legacy fallback for articles
// imported straight from the Excel sheet, which only ever had external
// image links, never real files - see the /api/stock route in
// veloclub.pb.js, which now prefers "images" and falls back to
// "image_urls" when an article has no uploaded files).
//
// Ordering: a PocketBase multi-file field's value IS an ordered array of
// filenames - the array order you send is the order it comes back as, no
// separate "sort order" column needed. Concretely, from the admin
// dashboard (superuser or "admins" token, already allowed to write to
// articles - see 1783900100_articles_admin_write_rules.js):
//   - Add image(s): PATCH /api/collections/articles/records/{id} as
//     multipart/form-data, with the new file(s) under the "images" field
//     (PocketBase appends them to whatever's already there, up to
//     maxSelect).
//   - Reorder existing images (no new upload): PATCH the same endpoint
//     with a plain JSON body { "images": ["b.jpg", "a.jpg", "c.jpg"] } -
//     listing the CURRENT filenames (from a GET) in the desired new
//     order. Sending a filename that already exists on the record is
//     treated as "keep it", not a re-upload.
//   - Remove specific image(s): PATCH as multipart/form-data with
//     "images-" (trailing dash) set to the filename(s) to delete.
// The full public URL for a stored filename is:
//   {appUrl}/api/files/articles/{articleId}/{filename}
// (appUrl = Dashboard > Settings > General > Application URL, same value
// already used to build article image URLs before the image_urls switch).

migrate((app) => {
  let articles = app.findCollectionByNameOrId("articles")
  articles.fields.add(
    new FileField({
      name: "images",
      maxSelect: 10,
      maxSize: 10485760, // 10MB per file
      mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
    }),
  )
  app.save(articles)
}, (app) => {
  let articles = app.findCollectionByNameOrId("articles")
  articles.fields.removeByName("images")
  app.save(articles)
})
