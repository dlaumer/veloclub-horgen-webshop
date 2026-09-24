import { OrderRecord, OrderItemRecord, LogRecord } from "@/lib/adminApi";

export interface EnrichedOrderItem {
  id: string;
  articleNumber: string;
  name: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  pricePaid: number;
  // quantity * the article's cost_price - what this line actually cost the
  // club to buy in, for the cost-price total shown on the order (see
  // AdminDashboard.tsx's enrichedOrders / OrderModal.tsx).
  costPrice: number;
  image: string;
  isReturn: boolean;
}

export interface EnrichedOrder extends OrderRecord {
  fullName: string;
  itemCount: number;
  items: EnrichedOrderItem[];
  // Timestamp + admin name from the most recent "ready" / "pickup" log
  // entry for this order, if any - lets the order detail view show *when*
  // and *who* marked it ready/picked up, not just that it happened. Only
  // populated while the order is CURRENTLY ready/picked up (see
  // AdminDashboard.tsx's enrichedOrders) - "ready"/"pickup" log entries are
  // never deleted (an undo adds a "ready_undo"/"pickup_undo" entry instead
  // of erasing the original), so without that gate this would keep showing
  // a stale timestamp after an undo.
  readyAt?: string;
  readyBy?: string;
  pickedAt?: string;
  pickedBy?: string;
  // Same idea, from the "cancel" log entry - cancellation is one-shot (no
  // undo), so unlike readyAt/pickedAt this doesn't need to be gated behind
  // a "currently cancelled" check to avoid a stale value.
  cancelledAt?: string;
  cancelledBy?: string;
  // The gross price the CUSTOMER paid. For "zahls"/"free" orders this is
  // just amount_paid (that field already holds the real charged amount -
  // see finalizeOrder in lib_zahls.js). For payment_provider === "legacy"
  // orders it is NOT amount_paid - the old Excel-import script
  // (backend/scripts/import_legacy_xlsx.mjs, computeActualAmount) already
  // stores amount_paid net of the estimated Zahls fee for those, so the
  // gross price has to be reconstructed from the order's items instead (sum
  // of items[].pricePaid, which mirrors the sheet's "Preis Total" column).
  // See moneyReceived below for the matching "amount actually kept" value.
  pricePaid: number;
  // What the club actually kept after Zahls/Payrexx's fee. For "legacy"
  // orders this IS amount_paid (already net, see pricePaid above) - for
  // everything else it's amount_paid minus the real or estimated provider
  // fee (see computeMoneyReceived in adminApi.ts). costPriceTotal is the
  // total cost_price of every item in the order (sum of items[].costPrice).
  // These three, plus pricePaid, are shown in OrderModal.tsx and summed in
  // AdminDashboard.tsx's stats.
  moneyReceived: number;
  costPriceTotal: number;
  // Same as costPriceTotal but excluding items[].isReturn lines (items given
  // away free/discounted via a "return_category" promo - see isReturn on
  // EnrichedOrderItem) - the cost of goods that actually generated revenue,
  // as opposed to goods given away as a promotion.
  costPricePaidTotal: number;
}

export interface ArticleSize {
  name: string;
  stock: number;
}

export interface EnrichedArticle {
  id: string; // article_number (sku)
  articleNumber: string;
  productId: string;
  name: string;
  price: number;
  image: string; // first image - used for list thumbnails
  images: string[]; // full gallery, in order - used by the detail modal's carousel
  image3d?: string; // 3D embed HTML (Sketchfab iframe etc.), same as the storefront's ProductModal
  colorName: string;
  colorCode: string;
  category: string;
  mainCategory: string;
  description?: string;
  sizes: ArticleSize[];
}

export interface EnrichedLog extends LogRecord {
  orderNumber: string;
  fullName: string;
  placedAt: string;
}

export type { OrderRecord, OrderItemRecord, LogRecord };
