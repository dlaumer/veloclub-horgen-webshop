import { useState, useMemo } from "react";
import { CategoryTabs } from "./CategoryTabs";
import { ProductCard } from "./ProductCard";
import { ProductModal } from "./ProductModal";
import { ShoppingCart } from "./ShoppingCart";
import { products } from "@/data/products";
import { Product, CartItem, CartState } from "@/types/shop";
import { useToast } from "@/hooks/use-toast";

const categories = [
  { id: 'all', label: 'All' },
  { id: 'men', label: 'Man' },
  { id: 'women', label: 'Woman' },
  { id: 'kids', label: 'Kids' },
  { id: 'others', label: 'Others' }
];

export const Shop = () => {
  const [activeCategory, setActiveCategory] = useState('men');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cart, setCart] = useState<CartState>({
    items: [],
    isOpen: false
  });
  const { toast } = useToast();

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'all') {
      return products;
    }
    return products.filter(product => product.category === activeCategory);
  }, [activeCategory]);

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleAddToCart = (productId: string, size: string, color: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existingItemIndex = cart.items.findIndex(
      item => item.productId === productId && item.size === size && item.color === color
    );

    if (existingItemIndex >= 0) {
      // Update existing item
      const updatedItems = [...cart.items];
      updatedItems[existingItemIndex].quantity += 1;
      setCart(prev => ({ ...prev, items: updatedItems }));
    } else {
      // Add new item
      const newItem: CartItem = {
        id: `${productId}-${size}-${color}-${Date.now()}`,
        productId,
        name: product.name,
        price: product.price,
        size,
        color,
        quantity: 1,
        image: product.image
      };
      setCart(prev => ({ ...prev, items: [...prev.items, newItem] }));
    }

    toast({
      title: "Added to cart",
      description: `${product.name} (${size}, ${color}) has been added to your cart.`,
    });
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCart(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }));
  };

  const handleToggleCart = () => {
    setCart(prev => ({ ...prev, isOpen: !prev.isOpen }));
  };

  const handleCheckout = () => {
    toast({
      title: "Proceeding to TWINT",
      description: "You will be redirected to TWINT for payment.",
    });
    // Here you would integrate with TWINT payment system
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-center mb-8">Our Products</h1>
        
        <CategoryTabs
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />
      </div>

      {/* Product Grid */}
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onProductClick={handleProductClick}
            />
          ))}
        </div>
      </div>

      {/* Product Modal */}
      <ProductModal
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedProduct(null);
        }}
        onAddToCart={handleAddToCart}
      />

      {/* Shopping Cart */}
      <ShoppingCart
        items={cart.items}
        isOpen={cart.isOpen}
        onToggle={handleToggleCart}
        onRemoveItem={handleRemoveFromCart}
        onCheckout={handleCheckout}
      />
    </div>
  );
};