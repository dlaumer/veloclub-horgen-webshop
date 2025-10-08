export interface Product {
  id: string;
  name: string;
  price: number;
  category:string;
  image: string; // Main image for the card
  colors: Array<{
    id: string;
    name: string;
    code: string;
    images: string[];
    sizes: Array<{
      name: string;
      stock: number;
    }>;
  }>;
  description?: string;
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
}

export interface CartState {
  items: CartItem[];
  isOpen: boolean;
}