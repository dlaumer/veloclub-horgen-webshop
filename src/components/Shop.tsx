import { useEffect, useMemo, useState } from "react";
import { CategoryTabs } from "./CategoryTabs";
import { ProductCard } from "./ProductCard";
import { ProductModal } from "./ProductModal";
import { ShoppingCart } from "./ShoppingCart";
// Removed: import { products } from "@/data/products";
import { Product, CartItem, CartState } from "@/types/shop";
import { useToast } from "@/hooks/use-toast";

// NEW: pull from the stock API
import { fetchStock, type Product as StockProduct } from "@/lib/stockApi"; // :contentReference[oaicite:0]{index=0}

const categories = [
  { id: "all", label: "All" },
  { id: "men", label: "Man" },
  { id: "women", label: "Woman" },
  { id: "kids", label: "Kids" },
  { id: "others", label: "Others" },
];

export const Shop = () => {
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cart, setCart] = useState<CartState>({ items: [], isOpen: false });
  const { toast } = useToast();

  // NEW: products now come from fetchStock()
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Adapt stock items (sku, imageUrl, etc.) to Shop Product
  const adapt = (s: StockProduct): Product => ({
    id: s.id,
    name: s.name,
    price: s.price,
    image: s.imageUrl ?? "",
    category: s.category,
    colors: s.colors,
  });

  useEffect(() => {
    let on = true;
    setLoading(true);
    fetchStock()
      .then((stock) => {
        if (!on) return;
        const mapped = stock.map(adapt);
        console.log(mapped);
        setAllProducts(mapped);
      })
      .catch((e) => on && setErr(String(e)))
      .finally(() => on && setLoading(false));
    return () => {
      on = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    if (activeCategory === "all") return allProducts;
    // If products don’t have categories yet, they'll fall under "others"
    return allProducts.filter((p) => p.category === activeCategory);
  }, [activeCategory, allProducts]);

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleAddToCart = (productId: string, size: string, color: string, colorId: string) => {
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return;

    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.productId === productId &&
        item.size === size &&
        item.colorId === colorId
    );

    if (existingItemIndex >= 0) {
      const updatedItems = [...cart.items];
      updatedItems[existingItemIndex].quantity += 1;
      setCart((prev) => ({ ...prev, items: updatedItems }));
    } else {
      const newItem: CartItem = {
        id: `${productId}-${size}-${colorId}-${Date.now()}`,
        productId,
        name: product.name,
        price: product.price,
        size,
        color,
        colorId,
        quantity: 1,
        image: product.image,
      };
      setCart((prev) => ({ ...prev, items: [...prev.items, newItem] }));
    }

    toast({
      title: "Added to cart",
      description: `${product.name} (${size}, ${color}) has been added to your cart.`,
    });
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCart((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));
  };

  const handleToggleCart = () => {
    setCart((prev) => ({ ...prev, isOpen: !prev.isOpen }));
  };

  const handleCheckout = () => {
    toast({
      title: "Proceeding to TWINT",
      description: "You will be redirected to TWINT for payment.",
    });
    // Integrate TWINT here
  };

  if (loading) {
    // Loading view while stock is fetched (matches the StockGrid “Loading stock…” pattern) :contentReference[oaicite:1]{index=1}
    return (
      <div className="min-h-screen bg-background p-3 sm:p-6">
        <div className="max-w-6xl mx-auto mb-6 sm:mb-8">
          <CategoryTabs
            categories={categories}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
        </div>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border p-4 shadow"
              >
                <div className="mb-3 h-40 w-full rounded bg-muted" />
                <div className="mb-2 h-5 w-2/3 rounded bg-muted" />
                <div className="mb-2 h-4 w-1/2 rounded bg-muted" />
                <div className="h-4 w-1/3 rounded bg-muted" />
              </div>
            ))}
          </div>
          <div className="mt-6 text-sm text-muted-foreground">Loading stock…</div>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto text-red-600">
          Error loading stock: {err}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6 sm:mb-8">
        <CategoryTabs
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />
      </div>

      {/* Product Grid - responsive */}
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredProducts.map((product) => (
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
