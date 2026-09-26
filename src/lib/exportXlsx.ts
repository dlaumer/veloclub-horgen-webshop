// Client-side Excel export for the admin dashboard's "download" buttons -
// generates .xlsx files entirely in the browser (via the "xlsx"/SheetJS
// package, already a dependency) from data the dashboard already has
// loaded, and triggers a normal file download. No backend route involved.
//
// Column layout deliberately mirrors the legacy "Velo Club Horgen
// Webshop.xlsx" (Lagerbestand / Bestellungen sheets) that
// backend/scripts/import_legacy_xlsx.py|mjs know how to read - same header
// names, same core column order - so the result looks familiar to whoever
// used the old sheet, with a few extra columns appended at the end for
// things that didn't exist back then (cancellation, promo codes, ...).

import * as XLSX from "xlsx";
import { ArticleRecord, ArticleItemRecord, parseTriState } from "@/lib/adminApi";
import { EnrichedOrder } from "@/types/admin";

function triStateLabel(v: ReturnType<typeof parseTriState>): string {
  if (v === true) return "Ja";
  if (v === false) return "Nein";
  return "";
}

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

function dateStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Same fixed size-column order as the legacy sheet (backend/scripts/
// import_legacy_xlsx.py's SIZE_COLUMNS) - kept first for familiarity. Any
// size actually used in the exported data that isn't in this list (a
// newly-added size, see ArticleModal's free-text size field) is appended
// afterwards instead of being dropped.
const LEGACY_SIZE_ORDER = [
  "OneSize", "6/7 Jahre", "8/9 Jahre", "10/11 Jahre", "12/13 Jahre",
  "36-41", "42-47", "XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL",
];

/**
 * Stock/Lagerbestand export - one row per article (color-variant record),
 * same granularity as the legacy sheet's "Artikel-Nr." rows. `articles` and
 * `items` should already be filtered to whatever the admin currently has
 * visible (category + search) in ArticlesPanel, matching "download what
 * I'm looking at".
 */
export function exportStockToXlsx(articles: ArticleRecord[], items: ArticleItemRecord[]) {
  const stockByArticle = new Map<string, Map<string, number>>();
  const usedSizes = new Set<string>();
  for (const it of items) {
    if (!stockByArticle.has(it.article)) stockByArticle.set(it.article, new Map());
    stockByArticle.get(it.article)!.set(it.size, it.stock);
    usedSizes.add(it.size);
  }

  const extraSizes = Array.from(usedSizes)
    .filter((s) => !LEGACY_SIZE_ORDER.includes(s))
    .sort();
  const sizeColumns = [...LEGACY_SIZE_ORDER.filter((s) => usedSizes.has(s)), ...extraSizes];

  const baseHeaders = [
    "Pos.", "Artikel-Nr.", "Handle", "Artikel", "Farbe", "Rubrik", "Kategorie",
    "Preis", "Preis\nThömus", "JustStock", "Rückgabe", "3D Bild",
    "Beschreibung", "Bemerkungen Lagerbestand",
  ];
  const headers = [...baseHeaders, ...sizeColumns];

  const sorted = [...articles].sort((a, b) => a.sort_order - b.sort_order);

  const rows = sorted.map((a) => {
    const sizes = stockByArticle.get(a.id) || new Map<string, number>();
    const row: (string | number)[] = [
      a.sort_order,
      a.article_number,
      a.product_id,
      a.color_name,
      a.color_code,
      a.main_category,
      a.category,
      a.price,
      a.cost_price,
      a.just_stock === "yes" ? "yes" : "no",
      a.return_category || "no",
      a.embed_3d ? "ja" : "",
      a.description || "",
      a.notes || "",
    ];
    for (const size of sizeColumns) {
      const stock = sizes.get(size);
      row.push(stock === undefined ? "" : stock);
    }
    return row;
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Lagerbestand");
  downloadWorkbook(wb, `Lagerbestand_${dateStamp()}.xlsx`);
}

/**
 * Orders/Bestellungen export - one row per order line item (same
 * granularity as the legacy sheet), grouped under each order's own fields
 * repeated per line, matching how the original sheet reads. `orders` should
 * already be whatever's currently filtered/visible in OrdersPanel.
 */
export function exportOrdersToXlsx(orders: EnrichedOrder[], rangeLabel: string) {
  const headers = [
    "Order ID", "Name", "Timestamp", "Email", "KidzBike", "Comments", "Währung",
    "Artikelnummer", "Grösse", "Farbe", "Anzahl", "Preis pro Artikel",
    "Einkaufspreis", "Bezahlt von Kunde (Total)", "Erhalten (Total)",
    "isReturn", "Promocode", "Storniert", "Bereit", "Abgeholt", "Zahlungsart",
  ];

  const rows: Array<Array<string | number | boolean | Date>> = [];

  for (const order of orders) {
    const fullName = [order.buyer_name, order.buyer_lastname].filter(Boolean).join(" ");
    const placedAt = order.placed_at ? new Date(order.placed_at) : "";
    const common = [
      order.order_number,
      fullName,
      placedAt,
      order.buyer_email,
      !!order.kidzbike,
      order.comments || "",
      order.currency || "CHF",
    ];
    const trailing = [
      order.promo_code || "",
      !!order.cancelled,
      triStateLabel(parseTriState(order.ready)),
      triStateLabel(parseTriState(order.picked_up)),
      order.payment_provider || "",
    ];
    // The order-level totals (what the customer paid in total, and what we
    // actually received after the payment provider's fee) only go on the
    // LAST row of the order - repeating them on every item row would make
    // them look like per-item amounts and double-count if someone sums the
    // column, same convention as the legacy sheet's "Summe Pro Kunde".
    const emptyTotals = ["", ""];
    const orderTotals = [order.pricePaid, order.moneyReceived];

    if (order.items.length === 0) {
      rows.push([...common, "", "", "", "", "", "", ...orderTotals, "", ...trailing]);
      continue;
    }

    order.items.forEach((item, idx) => {
      const isLast = idx === order.items.length - 1;
      rows.push([
        ...common,
        item.articleNumber,
        item.size,
        item.color,
        item.quantity,
        item.unitPrice,
        item.costPrice,
        ...(isLast ? orderTotals : emptyTotals),
        item.isReturn,
        ...trailing,
      ]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bestellungen");
  downloadWorkbook(wb, `Bestellungen_${rangeLabel}.xlsx`);
}
