#!/usr/bin/env node
// Node.js version of the legacy Excel importer - use this if the Python
// script hangs (e.g. due to a proxy Python's `requests` picks up that
// Node's fetch doesn't).
//
// Run this on YOUR OWN computer, not the server - it only needs network
// access to your public PocketBase URL and the local xlsx file.
//
// Requires Node 18+ (built-in fetch). Check with: node -v
//
// Setup (once):
//   npm install xlsx
//
// Usage:
//   node import_legacy_xlsx.mjs "C:\path\to\Velo Club Horgen Webshop (3).xlsx"
//
// Safe to re-run: articles are matched by article_number and orders by
// order_number, so anything already imported is skipped instead of
// duplicated.
//
// Optional --reset-orders flag: PERMANENTLY DELETES ALL existing "orders"
// records (and, via cascade delete, their order_items + logs) before
// importing, so you get a clean re-import instead of "already exists"
// skips. Requires typing a confirmation, and requires being logged in as
// superuser (orders' deleteRule is superuser-only). Only use this while
// testing/importing legacy data - never once the shop has real customer
// orders, since this cannot be undone.
//   node import_legacy_xlsx.mjs "C:\path\to\...xlsx" --reset-orders

// NOTE: must be a default import, not `import * as XLSX from "xlsx"` - the
// xlsx package's CJS-to-ESM interop only exposes readFile/utils/etc. on the
// default export, not as flattened named exports on the namespace object.
import XLSX from "xlsx";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import fs from "node:fs";

const POCKETBASE_URL = "https://api-webshop-veloclubhorgen.duckdns.org";

// Size columns as they appear in the Lagerbestand header. A cell value of
// "x" (or blank) means "this product doesn't come in that size" and is
// skipped; a number (incl. 0) means "comes in this size, this much stock".
const SIZE_COLUMNS = [
  "OneSize", "6/7 Jahre", "8/9 Jahre", "10/11 Jahre", "12/13 Jahre",
  "36-41", "42-47", "XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL",
];

const rl = readline.createInterface({ input, output });

function toIdStr(v) {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") return String(Math.trunc(v));
  return String(v).trim();
}

function parseImageUrls(raw) {
  if (!raw) return [];
  let s = String(raw).trim();
  if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);
  return s.split(",").map((u) => u.trim()).filter(Boolean);
}

// array-of-arrays, 0-indexed rows/cols, raw cell values (not formatted text)
function sheetRows(ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
}

function headerMap(rows, headerRowIndex) {
  const headers = rows[headerRowIndex] || [];
  const map = {};
  headers.forEach((h, i) => {
    if (h !== null && h !== undefined && h !== "") map[h] = i;
  });
  return map;
}

function requireCols(col, names, sheetName) {
  const missing = names.filter((n) => !(n in col));
  if (missing.length) {
    console.log(`\nERROR: sheet "${sheetName}" is missing expected column(s): ${missing.join(", ")}`);
    console.log(`Columns actually found: ${Object.keys(col).join(" | ")}`);
    process.exit(1);
  }
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = 15000) {
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

    const email = (
      await rl.question(
        "PocketBase superuser email (leave blank to skip login, e.g. if you temporarily opened up the collection API rules): "
      )
    ).trim();

    if (!email) {
      console.log("Skipping login - requests will be sent unauthenticated.");
      this.token = null;
      return;
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

  async findOne(collection, filterStr) {
    const url = new URL(`${this.baseUrl}/api/collections/${collection}/records`);
    url.searchParams.set("filter", filterStr);
    url.searchParams.set("perPage", "1");
    const res = await fetchWithTimeout(url.toString(), { headers: this.headers() }, 15000);
    if (!res.ok) throw new Error(`find_one ${collection} failed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    return json.items && json.items[0] ? json.items[0] : null;
  }

  async create(collection, data) {
    const res = await fetchWithTimeout(
      `${this.baseUrl}/api/collections/${collection}/records`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.headers() },
        body: JSON.stringify(data),
      },
      15000
    );
    if (!res.ok) {
      const text = await res.text();
      console.log(`  ERROR creating ${collection}: ${res.status} ${text}`);
      console.log(`  payload was:`, data);
      throw new Error(`create ${collection} failed`);
    }
    return res.json();
  }

  async update(collection, id, data) {
    const res = await fetchWithTimeout(
      `${this.baseUrl}/api/collections/${collection}/records/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...this.headers() },
        body: JSON.stringify(data),
      },
      15000
    );
    if (!res.ok) {
      const text = await res.text();
      console.log(`  ERROR updating ${collection}/${id}: ${res.status} ${text}`);
      console.log(`  payload was:`, data);
      throw new Error(`update ${collection} failed`);
    }
    return res.json();
  }

  async list(collection, { perPage = 200, page = 1 } = {}) {
    const url = new URL(`${this.baseUrl}/api/collections/${collection}/records`);
    url.searchParams.set("perPage", String(perPage));
    url.searchParams.set("page", String(page));
    const res = await fetchWithTimeout(url.toString(), { headers: this.headers() }, 15000);
    if (!res.ok) throw new Error(`list ${collection} failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async delete(collection, id) {
    const res = await fetchWithTimeout(
      `${this.baseUrl}/api/collections/${collection}/records/${id}`,
      { method: "DELETE", headers: this.headers() },
      15000
    );
    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      throw new Error(`delete ${collection}/${id} failed: ${res.status} ${text}`);
    }
  }

  // Repeatedly re-fetches page 1 and deletes whatever's there, instead of
  // paging through - deleting shifts later records down a page, so walking
  // page 1/2/3... forward would silently skip records.
  async deleteAll(collection) {
    let deleted = 0;
    while (true) {
      const json = await this.list(collection, { perPage: 200, page: 1 });
      const items = json.items || [];
      if (!items.length) break;
      for (const item of items) {
        await this.delete(collection, item.id);
        deleted++;
      }
    }
    return deleted;
  }
}

// Payment gateway fee model used to derive the amount actually received per
// order, since the sheet's own "Tatsächlich eingegangen" / "Summe Pro Kunde"
// columns turned out to be unreliable. Instead: sum "Preis Total" across all
// of a client's order rows, then apply the fee once per order (fees are
// charged per transaction, not per line item).
const FEE_RATE = 0.029;
const FEE_FIXED = 0.3;

function computeActualAmount(totalPrice) {
  const raw = totalPrice * (1 - FEE_RATE) - FEE_FIXED;
  // clamp at 0 - a free (return-promo) order has no real transaction, so it
  // can't have "received" a negative amount.
  return Math.max(0, Math.round(raw * 100) / 100);
}

async function importArticles(wb, pb) {
  const ws = wb.Sheets["Lagerbestand"];
  const rows = sheetRows(ws);
  const col = headerMap(rows, 4); // real header row is Excel row 5 -> index 4
  requireCols(col, ["Artikel-Nr.", "Handle", "Preis", "URL Artikelbild"], "Lagerbestand");

  const articleIdByNumber = {};
  let nArticles = 0;
  let nItems = 0;

  for (let r = 5; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const articleNumber = toIdStr(row[col["Artikel-Nr."]]);
    if (!articleNumber) continue;

    const existing = await pb.findOne("articles", `article_number = "${articleNumber}"`);
    let rec;
    if (existing) {
      // NOTE: still fall through to the size/stock loop below - an earlier
      // run may have crashed after creating the article but before
      // finishing its article_items rows, so we must not skip those. Each
      // article_items row is checked/created individually.
      console.log(`  articles: ${articleNumber} already exists, skipping create`);
      rec = existing;
    } else {
      const data = {
        article_number: articleNumber,
        product_id: row[col["Handle"]] || "",
        name: row[col["Handle"]] || "",
        price: row[col["Preis"]] || 0,
        cost_price: row[col["Preis\nThömus"]] || 0,
        main_category: row[col["Rubrik"]] || "",
        category: row[col["Kategorie"]] || "",
        color_name: row[col["Artikel"]] || "",
        color_code: row[col["Farbe"]] || "",
        image_urls: parseImageUrls(row[col["URL Artikelbild"]]),
        embed_3d: row[col["3D Bild"]] || "",
        just_stock: row[col["JustStock"]] || "no",
        return_category: row[col["Rückgabe"]] || "no",
        description: row[col["Beschreibung"]] || "",
        notes: row[col["Bemerkungen Lagerbestand"]] || "",
        sort_order: row[col["Pos."]] || 0,
      };

      rec = await pb.create("articles", data);
      nArticles++;
      console.log(`  articles: created ${articleNumber} (${data.name} / ${data.color_name})`);
    }

    articleIdByNumber[articleNumber] = rec.id;

    for (const sizeName of SIZE_COLUMNS) {
      if (!(sizeName in col)) continue;
      const val = row[col[sizeName]];
      if (val === null || val === undefined || typeof val === "string") continue; // 'x' or blank
      const existingItem = await pb.findOne(
        "article_items",
        `article = "${rec.id}" && size = "${sizeName}"`
      );
      if (existingItem) continue;
      await pb.create("article_items", {
        article: rec.id,
        size: sizeName,
        stock: Math.trunc(Number(val)),
      });
      nItems++;
    }
  }

  console.log(`articles imported: ${nArticles}, article_items imported: ${nItems}`);
  return articleIdByNumber;
}

async function importOrders(wb, pb, articleIdByNumber) {
  const ws = wb.Sheets["Bestellungen"];
  const rows = sheetRows(ws);
  const col = headerMap(rows, 0);
  requireCols(col, ["Order ID", "Name", "Email", "Artikelnummer", "Preis Total"], "Bestellungen");

  const orders = new Map();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const oid = toIdStr(row[col["Order ID"]]);
    if (!oid) continue;
    if (!orders.has(oid)) orders.set(oid, []);
    orders.get(oid).push(r);
  }

  let nOrders = 0;
  let nItems = 0;
  let nLogs = 0;

  for (const [oid, rowIndexes] of orders) {
    const first = rows[rowIndexes[0]];
    const nameFull = String(first[col["Name"]] || "").trim();
    const parts = nameFull.split(/\s+/).filter(Boolean);
    const buyerName = parts[0] || "unknown";
    const buyerLastname = parts.slice(1).join(" ");

    const timestampRaw = first[col["Timestamp"]];
    const placedAt = timestampRaw instanceof Date ? timestampRaw.toISOString() : "";

    // Don't trust "Tatsächlich eingegangen" / "Summe Pro Kunde" - they turned
    // out to be unreliable. Derive the real total ourselves: sum "Preis
    // Total" across all of this order's rows, then apply the payment fee
    // once for the whole order.
    const totalPrice = rowIndexes.reduce((sum, r) => sum + (Number(rows[r][col["Preis Total"]]) || 0), 0);
    const actualAmount = computeActualAmount(totalPrice);

    const existingOrder = await pb.findOne("orders", `order_number = "${oid}"`);

    let orderRec;
    let createItems;

    if (existingOrder) {
      orderRec = existingOrder;
      createItems = false;
      console.log(`  orders: ${oid} already exists, skipping create`);

      // correct amount_paid if an earlier run stored the old, wrong value
      const existingAmount = Number(existingOrder.amount_paid) || 0;
      if (Math.abs(existingAmount - actualAmount) > 0.001) {
        console.log(`    orders: correcting amount_paid for ${oid}: ${existingAmount} -> ${actualAmount}`);
        await pb.update("orders", orderRec.id, { amount_paid: actualAmount });
      }
    } else {
      const orderData = {
        order_number: oid,
        buyer_name: buyerName,
        buyer_lastname: buyerLastname,
        buyer_email: first[col["Email"]] || "",
        kidzbike: !!first[col["KidzBike"]],
        comments: first[col["Comments"]] || "",
        payment_provider: "legacy",
        payment_status: "confirmed",
        amount_paid: actualAmount,
        currency: first[col["Währung"]] || "CHF",
        placed_at: placedAt,
        // tri-state text field: "" = unknown. Legacy data doesn't tell us
        // whether an order was ever marked ready/picked up, so leave it
        // explicitly unknown rather than defaulting to "no" (which would
        // wrongly imply we know it wasn't).
        ready: "",
        picked_up: "",
      };

      orderRec = await pb.create("orders", orderData);
      nOrders++;
      createItems = true;
      console.log(`  orders: created ${oid} (${buyerName} ${buyerLastname}), amount_paid=${actualAmount}`);
    }

    // Backfill support: an earlier run of this script (before "logs" support
    // was added) may have already created this order without a purchase log
    // entry. Detect that and add the missing log now, without re-creating
    // order_items (those already exist).
    let needLog = true;
    if (!createItems) {
      const alreadyLogged = await pb.findOne("logs", `order = "${orderRec.id}" && kind = "purchase"`);
      needLog = !alreadyLogged;
    }

    if (!createItems && !needLog) {
      continue; // this order is fully done already, nothing left to do
    }

    const noteParts = [];
    for (const r of rowIndexes) {
      const row = rows[r];
      const articleNumber = toIdStr(row[col["Artikelnummer"]]);
      const articleId = articleIdByNumber[articleNumber];
      if (!articleId) {
        console.log(`    WARNING: order ${oid} references unknown article ${articleNumber}, skipping line`);
        continue;
      }

      const size = row[col["Grösse"]] || "";
      const qty = row[col["Anzahl"]] || 0;

      if (createItems) {
        const itemData = {
          order: orderRec.id,
          article: articleId,
          size,
          color: row[col["Farbe"]] || "",
          quantity: qty,
          unit_price: row[col["Preis pro Artikel"]] || 0,
          // "Preis Total" already reflects this line's actual charged
          // amount (e.g. 0 or reduced for a return-promo item) - the fee
          // deduction is applied once at the order level, not per line.
          price_paid: row[col["Preis Total"]] || 0,
          is_return: !!row[col["isReturn"]],
          return_category: "",
        };
        await pb.create("order_items", itemData);
        nItems++;
      }

      if (needLog) {
        noteParts.push(`${articleNumber} x${qty} (${size})`);
      }
    }

    if (needLog) {
      // so legacy orders show up in the dashboard's log/history view too,
      // same as orders placed through the new system - just as a single
      // "purchase" entry (we don't know ready/picked_up history for these,
      // see the ready/picked_up "" = unknown convention above).
      const action = createItems ? "creating" : "backfilling missing";
      console.log(`    logs: ${action} purchase log for ${oid}`);
      await pb.create("logs", {
        order: orderRec.id,
        kind: "purchase",
        note: noteParts.join(", "),
        placed_at: placedAt,
      });
      nLogs++;
    }
  }

  console.log(`orders imported: ${nOrders}, order_items imported: ${nItems}, logs imported: ${nLogs}`);
}

async function main() {
  const args = process.argv.slice(2);
  const resetOrders = args.includes("--reset-orders");
  const xlsxPath = args.find((a) => !a.startsWith("--"));

  if (!xlsxPath) {
    console.log(`Usage: node ${process.argv[1]} <path-to-xlsx> [--reset-orders]`);
    process.exit(1);
  }
  if (!fs.existsSync(xlsxPath)) {
    console.log(`File not found: ${xlsxPath}`);
    process.exit(1);
  }

  console.log(`Reading ${xlsxPath}...`);
  const wb = XLSX.readFile(xlsxPath, { cellDates: true });
  console.log(`Sheets found: ${wb.SheetNames.join(", ")}`);

  const pb = new PocketBase(POCKETBASE_URL);
  await pb.login();

  if (resetOrders) {
    console.log(
      "\n--reset-orders passed: this will PERMANENTLY DELETE ALL existing 'orders' " +
        "records (and, via cascade delete, their order_items + logs entries too)."
    );
    const confirm = (await rl.question('Type "DELETE" to confirm, anything else to abort: ')).trim();
    if (confirm !== "DELETE") {
      console.log("Aborted - nothing was deleted.");
      process.exit(1);
    }
    console.log("Deleting all existing orders...");
    const nDeleted = await pb.deleteAll("orders");
    console.log(`Deleted ${nDeleted} orders (their order_items/logs were cascade-deleted automatically).`);
  }

  console.log("\nImporting articles + stock...");
  const articleIdByNumber = await importArticles(wb, pb);

  console.log("\nImporting historical orders...");
  await importOrders(wb, pb, articleIdByNumber);

  console.log("\nDone.");
  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
