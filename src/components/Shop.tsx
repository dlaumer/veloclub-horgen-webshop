// Shop.tsx
import { useEffect, useMemo, useState } from "react";
import { Header } from "./Header";
import { FilterBar } from "./FilterBar";
import { ProductCard } from "./ProductCard";
import { ProductModal } from "./ProductModal";
import { ShoppingCart } from "./ShoppingCart";
import { CheckoutForm, CheckoutFormData } from "./CheckoutForm";
import { Product, CartItem, CartState } from "@/types/shop";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";

// NEW: stock APIs
import { fetchStock, type Product as StockProduct, commitStockOnPay } from "@/lib/stockApi"; // <-- add commitStockOnPay

export const Shop = () => {
  const { t } = useTranslation();
  const [activeMainCategory, setActiveMainCategory] = useState("velokleider");
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cart, setCart] = useState<CartState>({ items: [], isOpen: false });
  const [isPaying, setIsPaying] = useState(false); // <-- NEW
  const { toast } = useToast();

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [isCheckoutFormOpen, setIsCheckoutFormOpen] = useState(false);
  const [checkoutData, setCheckoutData] = useState<CheckoutFormData | null>(null);

  const adapt = (s: StockProduct): Product => ({
    id: s.id,
    name: s.name,
    price: s.price,
    image: s.image ?? "",
    mainCategory: "velokleider", // Default to Velokleider for now
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
        setAllProducts(mapped);
      })
      .catch((e) => on && setErr(String(e)))
      .finally(() => on && setLoading(false));
    return () => { on = false; };
  }, []);

  const filteredProducts = useMemo(() => {
    let filtered = allProducts.filter((p) => p.mainCategory === activeMainCategory);
    if (activeCategory !== "all") {
      filtered = filtered.filter((p) => p.category === activeCategory);
    }
    return filtered;
  }, [activeMainCategory, activeCategory, allProducts]);

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
        colorId,          // 👈 IMPORTANT: this is the SKU per color (article number)
        quantity: 1,
        image: product.image,
      };
      setCart((prev) => ({ ...prev, items: [...prev.items, newItem] }));
    }

    toast({
      title: t('addedToCart'),
      description: `${product.name} (${size}, ${color}) ${t('hasBeenAddedToCart')}`,
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
    if (cart.items.length === 0) return;
    setIsCheckoutFormOpen(true);
  };

  const handleCheckoutFormSubmit = async (data: CheckoutFormData) => {
    if (isPaying) return;

    setCheckoutData(data);

    try {
      setIsPaying(true);

      const lines = cart.items.map(i => ({
        sku: i.colorId,     // article number per color
        size: i.size,
        qty: i.quantity,    // commitStockOnPay will convert to negative deltas
      }));

      // Call delta endpoint
      const res = await commitStockOnPay(lines);
      if (!res.ok) throw new Error(res.error || "Stock update failed");

      // ✅ Use the returned stock directly to refresh UI
      const mapped = res.data.map(adapt);          // adapt = your StockProduct -> Product mapper
      setAllProducts(mapped);

      // If the modal is open, refresh the selected product from the new data
      setSelectedProduct(prev =>
        prev ? (mapped.find(p => p.id === prev.id) ?? null) : prev
      );

      // Clear cart + close
      setCart({ items: [], isOpen: false });
      setIsCheckoutFormOpen(false);
      setCheckoutData(null);

      toast({ title: t('success'), description: t('stockUpdated') });
    } catch (e: any) {
      console.error(e);
      toast({ title: t('error'), description: e?.message || String(e), variant: "destructive" });
    } finally {
      setIsPaying(false);
    }
  };


  if (loading) {
    return (
      <>
        <Header
          activeMainCategory={activeMainCategory}
          onMainCategoryChange={setActiveMainCategory}
        />
        <div className="min-h-screen bg-background p-3 sm:p-6">
          <div className="max-w-6xl mx-auto">
            <FilterBar
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl border p-4 shadow">
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
      </>
    );
  }

  if (err) {
    return (
      <>
        <Header
          activeMainCategory={activeMainCategory}
          onMainCategoryChange={setActiveMainCategory}
        />
        <div className="min-h-screen bg-background p-6">
          <div className="max-w-6xl mx-auto text-red-600">
            Error loading stock: {err}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        activeMainCategory={activeMainCategory}
        onMainCategoryChange={setActiveMainCategory}
      />
      <div className="min-h-screen bg-background p-3 sm:p-6">
        <div className="max-w-6xl mx-auto">
          <FilterBar
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />

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

        <ProductModal
          product={selectedProduct}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedProduct(null);
          }}
          onAddToCart={handleAddToCart}
        />

        <ShoppingCart
          items={cart.items}
          isOpen={cart.isOpen}
          onToggle={handleToggleCart}
          onRemoveItem={handleRemoveFromCart}
          onCheckout={handleCheckout}
          isPaying={isPaying}
        />

        <CheckoutForm
          isOpen={isCheckoutFormOpen}
          onClose={() => setIsCheckoutFormOpen(false)}
          onSubmit={handleCheckoutFormSubmit}
          isPaying={isPaying}
        />
      </div>
    </>
  );
};
