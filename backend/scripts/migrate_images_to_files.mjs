#!/usr/bin/env node
// HISTORICAL / already run: this was the one-off migration that downloaded
// each article's external image_urls and re-uploaded them as real files
// into the "images" field (see backend/pb_migrations/1783901500_articles_
// uploaded_images.js). image_urls itself has since been removed from the
// schema entirely (see 1783902000_articles_drop_image_urls.js), so this
// script can no longer run - PocketBase will simply not return an
// "image_urls" property anymore, so `article.image_urls` reads as
// undefined and every article looks like it has nothing to migrate. Kept
// here for reference only. If you ever need to bulk-upload images again
// from a list of URLs, copy the download/upload helpers below rather than
// trying to run this file as-is.
//
// Run this on YOUR OWN computer, not the server - it needs network access
// to both your public PocketBase URL and to whatever site currently hosts
// the images (e.g. webshop-veloclubhorgen.ch).
//
// Requires Node 18+ (built-in fetch, FormData, Blob). Check with: node -v
//
// Usage:
//   node migrate_images_to_files.mjs
//
// Safe to re-run: an article is only skipped once it already has exactly
// as many uploaded "images" as it has image_urls (i.e. fully migrated).
// Anything else - no images yet, or a stray partial set left over from an
// earlier/interrupted run - gets its existing images deleted and replaced
// with a freshly downloaded, correctly-ordered full set, all in one
// request (PocketBase file fields replace-on-submit within a single
// request, they don't accumulate across separate requests - uploading one
// at a time in separate PATCH calls would silently overwrite the previous
// one each time, which is why this downloads everything for an article
// first and only then does a single combined upload+delete PATCH).
// A single bad/unreachable URL only drops that one image from the batch -
// the rest of that article's images, and every other article, still go
// through.
//
// "image_urls" itself is left untouched - /api/stock already prefers the
// new "images" field and only falls back to image_urls when it's empty,
// so nothing needs to be cleaned up there.

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const POCKETBASE_URL = "https://api-webshop-veloclubhorgen.duckdns.org";

const rl = readline.createInterface({ input, output });

async function fetchWithTimeout(url, opts = {}, timeoutMs = 20000) {
  return fetch(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) });
}

class PocketBase {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = null;
  }

  async login() {
    console.log(`Checking ${this.baseUrl} is reachable...`);
    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/api/health`, {}, 10000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log("Server is reachable.");
    } catch (err) {
      console.log(`\nCould NOT reach ${this.baseUrl}: ${err.message || err}`);
      console.log("Check that PocketBase is running and this URL is correct/public before continuing. Aborting.");
      process.exit(1);
    }

    const email = (await rl.question("PocketBase superuser email: ")).trim();
    if (!email) {
      console.log("Email is required (this script needs write access to articles). Aborting.");
      process.exit(1);
    }
    const password = (await rl.question("PocketBase superuser password (visible while typing): ")).trim();
    console.log("Logging in...");

    let res;
    try {
      res = await fetchWithTimeout(
        `${this.baseUrl}/api/collections/_superusers/auth-with-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identity: email, password }),
        },
        15000
      );
    } catch (err) {
      console.log(`\nLogin request failed: ${err.message || err}`);
      process.exit(1);
    }
    if (!res.ok) {
      console.log(`\nLogin failed (${res.status}): ${await res.text()}`);
      process.exit(1);
    }
    const json = await res.json();
    this.token = json.token;
    console.log("Logged in.");
  }

  headers() {
    return this.token ? { Authorization: this.token } : {};
  }

  async listAll(collection) {
    let page = 1;
    let all = [];
    while (true) {
      const url = new URL(`${this.baseUrl}/api/collections/${collection}/records`);
      url.searchParams.set("perPage", "200");
      url.searchParams.set("page", String(page));
      const res = await fetchWithTimeout(url.toString(), { headers: this.headers() }, 15000);
      if (!res.ok) throw new Error(`list ${collection} failed: ${res.status} ${await res.text()}`);
      const json = await res.json();
      all = all.concat(json.items || []);
      if (page >= (json.totalPages || 1)) break;
      page++;
    }
    return all;
  }

  /** Replaces an article's "images": deletes every filename in
   * `existingFilenames` (via the "images-" removal modifier) and adds
   * `files` (in order) - all in a single PATCH, so there's no window
   * where old and new images briefly coexist/duplicate, and no risk of
   * one upload silently clobbering another (see the file header comment -
   * PocketBase file fields are set fresh per request, not accumulated
   * across separate requests). */
  async replaceArticleImages(articleId, existingFilenames, files) {
    const form = new FormData();
    for (const fn of existingFilenames) form.append("images-", fn);
    for (const f of files) form.append("images", f.blob, f.filename);
    const res = await fetchWithTimeout(
      `${this.baseUrl}/api/collections/articles/records/${articleId}`,
      {
        method: "PATCH",
        // don't set Content-Type manually - fetch computes the multipart
        // boundary itself from the FormData body.
        headers: this.headers(),
        body: form,
      },
      120000
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status} ${text}`);
    }
    return res.json();
  }
}

function extensionFromContentType(ct) {
  if (!ct) return ".jpg";
  if (ct.includes("png")) return ".png";
  if (ct.includes("webp")) return ".webp";
  if (ct.includes("gif")) return ".gif";
  if (ct.includes("avif")) return ".avif";
  return ".jpg";
}

function filenameFromUrl(url, index, contentType) {
  let base = "";
  try {
    base = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
  } catch {
    /* ignore - fall through to generated name */
  }
  base = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!base) base = `image_${index}`;
  if (!/\.[a-zA-Z0-9]+$/.test(base)) base += extensionFromContentType(contentType);
  return base;
}

async function downloadImage(url) {
  const res = await fetchWithTimeout(url, {}, 30000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`not an image (content-type: ${contentType || "unknown"})`);
  }
  const buf = await res.arrayBuffer();
  return { buf, contentType };
}

async function main() {
  const pb = new PocketBase(POCKETBASE_URL);
  await pb.login();

  console.log("\nFetching articles...");
  const articles = await pb.listAll("articles");
  console.log(`Found ${articles.length} articles.`);

  let articlesMigrated = 0;
  let articlesSkipped = 0;
  let imagesUploaded = 0;
  let imagesFailed = 0;

  for (const article of articles) {
    const urls = Array.isArray(article.image_urls) ? article.image_urls : [];
    const existingImages = Array.isArray(article.images) ? article.images : [];

    if (!urls.length) {
      console.log(`  ${article.article_number}: no image_urls, skipping`);
      articlesSkipped++;
      continue;
    }
    if (existingImages.length === urls.length) {
      console.log(`  ${article.article_number}: already has ${existingImages.length}/${urls.length} uploaded images, skipping`);
      articlesSkipped++;
      continue;
    }

    // download everything first - only then do we touch the record, so a
    // slow/broken URL never leaves the article's images half-updated
    const files = [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        const { buf, contentType } = await downloadImage(url);
        const filename = filenameFromUrl(url, i, contentType);
        files.push({ blob: new Blob([buf], { type: contentType || "image/jpeg" }), filename });
      } catch (err) {
        console.log(`    WARNING: ${article.article_number} image ${i} (${url}) failed to download: ${err.message || err}`);
        imagesFailed++;
      }
    }

    if (!files.length) {
      console.log(`  ${article.article_number}: all ${urls.length} image(s) failed to download, nothing uploaded`);
      continue;
    }

    if (existingImages.length) {
      console.log(
        `  ${article.article_number}: replacing ${existingImages.length} existing image(s) with ${files.length} fresh one(s)`,
      );
    }

    try {
      await pb.replaceArticleImages(article.id, existingImages, files);
      imagesUploaded += files.length;
      articlesMigrated++;
      console.log(`  ${article.article_number}: uploaded ${files.length}/${urls.length} image(s)`);
    } catch (err) {
      console.log(`  ERROR ${article.article_number}: upload failed: ${err.message || err}`);
    }
  }

  console.log(
    `\nDone. articles migrated: ${articlesMigrated}, articles skipped: ${articlesSkipped}, ` +
      `images uploaded: ${imagesUploaded}, images failed: ${imagesFailed}`
  );
  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
