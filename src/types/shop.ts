export interface Product {
  id: string;
  name: string;
  price: number;
  mainCategory: string; // Velokleider, Thömus Bike & Parts, etc.
  justStock?: string; // 'yes' | 'no' | undefined
  category: string; // men, women, kids
  image: string; // Main image for the card
  image3d?: string; // HTML embed code for 3D viewer (e.g., Sketchfab iframe)
  colors: Array<{
    id: string;
    name: string;
    code: string;
    images: string[];
    sizes: Array<{
      name: string;
      stock: number;
      justStock?: string;
    }>;
  }>;
  description?: string;
  isReturn?: string; // 'yes' | 'no' | undefined - indicates if item is eligible for return exchange
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  size: string;
  color: string;
  colorId: string;
  quantity: number;
  image: string;
  isReturn?: boolean; // true if user is returning old item for this product
}

export interface CartState {
  items: CartItem[];
  isOpen: boolean;
}