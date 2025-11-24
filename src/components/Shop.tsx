// Shop.tsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "./Header";
import { FilterBar, FilterOption } from "./FilterBar";
import { ProductCard } from "./ProductCard";
import { ProductModal } from "./ProductModal";
import { ShoppingCart } from "./ShoppingCart";
import { CheckoutForm, CheckoutFormData } from "./CheckoutForm";
import { Product, CartItem, CartState } from "@/types/shop";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";

// NEW: stock APIs
import { fetchStock, type Product as StockProduct } from "@/lib/stockApi"; // <-- add commitStockOnPay

const API_BASE = import.meta.env.VITE_API_BASE || '';

// Filter configuration for each main category
const CATEGORY_FILTERS: Record<string, FilterOption[]> = {
  velokleider: [
    { id: "all", labelKey: "all" },
    { id: "men", labelKey: "men" },
    { id: "women", labelKey: "women" },
    { id: "kids", labelKey: "kids" },
    { id: "others", labelKey: "others" },
  ],
  // Add filters for other categories when needed:
  // "thomus": [...],
  // "vch": [...],
  // "sonderkationen": [...],
};

export const Shop = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeMainCategory, setActiveMainCategory] = useState(() => {
    const rubrik = searchParams.get("rubrik");
    return rubrik || "velokleider";
  });
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
    mainCategory: s.mainCategory,
    category: s.category,
    colors: s.colors,
    justStock: s.justStock,
    description: s.description,
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

  const handleMainCategoryChange = (category: string) => {
    setActiveMainCategory(category);
    setActiveCategory("all");
    setSearchParams({ rubrik: category });
  };

  // Get filters for current main category
  const currentFilters = CATEGORY_FILTERS[activeMainCategory] || [];

  const filteredProducts = useMemo(() => {
    let filtered = allProducts.filter((p) => p.mainCategory === activeMainCategory);
    // Only apply sub-category filter if filters exist and not "all"
    if (currentFilters.length > 0 && activeCategory !== "all") {
      filtered = filtered.filter((p) => p.category === activeCategory);
    }
    return filtered;
  }, [activeMainCategory, activeCategory, allProducts, currentFilters]);

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleAddToCart = (productId: string, size: string, color: string, colorId: string, quantity: number = 1) => {
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
      updatedItems[existingItemIndex].quantity += quantity;
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
        quantity: quantity,
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

  function chfToRappen(x: number | string) {
  // robust gegen "205.50" (string) und float-Rundungsfehler
  return Math.round(Number(x) * 100);
}


  const handleCheckoutFormSubmit = async (data: CheckoutFormData) => {
    if (isPaying) return;

    try {
      setIsPaying(true);

      // 1) Map your cart to what the Worker expects
      const cartPayload = cart.items.map((i) => ({
        sku: i.colorId,           // your SKU per color/variant
        size: i.size,
        qty: i.quantity,
        name: i.name,
        unit_amount: chfToRappen(i.price),     // in Rappen (CHF * 100)
        image: i.image ?? "",
      }));

      if (cartPayload.length === 0) {
        // show your toast/notice
        toast({ title: "Warenkorb leer", variant: "destructive" });
        setIsPaying(false);
        return;
      }

      // 2) Build customer object (match what you collect on your form)
      const customer = {
        name: data.name,
        lastName: data.lastName,
        email: data.email,
        street: data.street,
        postalCode: data.postalCode,
        city: data.city,
        country: data.country

      };

      // 3) Create a stable order id (also used as idempotency key server-side)
      const orderId = `order_${Date.now()}`;
      console.log(cartPayload)
      // 4) Call your Worker
      const res = await fetch(`${API_BASE}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer, cart: cartPayload, orderId })
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Checkout init fehlgeschlagen: ${msg}`);
      }

      const { url } = await res.json();

      // 5) Redirect to Stripe Checkout (QR/App happens there)
      window.location.href = url;

      // IMPORTANT:
      // - DO NOT clear cart yet; wait for webhook to book stock.
      // - On your /thank-you page you can clear cart locally.
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Fehler beim Checkout",
        description: err?.message ?? String(err),
        variant: "destructive"
      });
      setIsPaying(false);
    }
  }


  if (loading) {
    return (
      <>
        <Header
          activeMainCategory={activeMainCategory}
          onMainCategoryChange={handleMainCategoryChange}
        />
        <div className="min-h-screen bg-background p-3 sm:p-6">
          <div className="max-w-6xl mx-auto">
            <FilterBar
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              filters={currentFilters}
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
          onMainCategoryChange={handleMainCategoryChange}
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
        onMainCategoryChange={handleMainCategoryChange}
      />
      <div className="min-h-screen bg-background p-3 sm:p-6">
        <div className="max-w-6xl mx-auto">
          <FilterBar
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            filters={currentFilters}
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
