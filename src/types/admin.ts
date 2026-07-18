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
  image: string;
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
