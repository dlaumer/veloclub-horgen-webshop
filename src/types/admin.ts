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
