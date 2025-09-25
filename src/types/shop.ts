export interface Product {
  id: string;
  name: string;
  price: number;
  category: 'men' | 'women' | 'kids' | 'others';
  image: string;
  colors: Array<{
    name: string;
    code: string;
  }>;
  sizes: Array<{
    name: string;
    stock: number;
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
  quantity: number;
  image: string;
}

export interface CartState {
  items: CartItem[];
  isOpen: boolean;
}