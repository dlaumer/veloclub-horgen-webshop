import React, { useState } from "react";
import { X, ChevronLeft, ChevronRight, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartItem, Product } from "@/types/shop";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

interface ProductModalProps {
  product: Product | null;
  isOpen: boolean;
  cartItems: CartItem[];
  onClose: () => void;
  onAddToCart: (productId: string, size: string, color: string, colorId: string, quantity: number, image: string) => void;
}

export const ProductModal = ({ product, isOpen, cartItems, onClose, onAddToCart }: ProductModalProps) => {
  const { t } = useTranslation();
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  React.useEffect(() => {
    if (product) {
      setSelectedColor(product.colors[0]?.name || "");
      setSelectedSize("");
      setCurrentImageIndex(0);
      setQuantity(1);
    }
  }, [product]);

  React.useEffect(() => {
    setCurrentImageIndex(0);
  }, [selectedColor]);

  React.useEffect(() => {
    if (product && selectedColor) {
      const colorData = product.colors.find((c) => c.name === selectedColor);
      const sizes = colorData?.sizes || [];
      if (sizes.length === 1) {
        setSelectedSize(sizes[0].name);
      }
    }
  }, [product, selectedColor]);

  React.useEffect(() => {
    setQuantity(1);
  }, [selectedColor, selectedSize]);

  if (!isOpen || !product) return null;

  const selectedColorData = product.colors.find((c) => c.name === selectedColor);

  let regularImages: string[] = [];
  const rawImages: unknown = selectedColorData?.images;
  if (Array.isArray(rawImages)) {
    regularImages = rawImages.filter(Boolean);
  } else if (typeof rawImages === "string" && rawImages.trim()) {
    const trimmed = rawImages.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        regularImages = Array.isArray(parsed) ? parsed.filter(Boolean) : [trimmed];
      } catch {
        regularImages = [trimmed];
      }
    } else {
      regularImages = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }

  const placeholderImage = "/placeholder.png";
  if (regularImages.length === 0 && product.image) {
    regularImages = [product.image];
  }

  const image3dValue = selectedColorData?.image3d;
  const has3dEmbed = image3dValue && typeof image3dValue === "string" && image3dValue.trim() !== "";
  const galleryItems: Array<{ type: "3d" | "image"; content: string }> = [];

  if (has3dEmbed) {
    galleryItems.push({ type: "3d", content: image3dValue });
  }
  regularImages.forEach((img) => {
    galleryItems.push({ type: "image", content: img });
  });

  if (galleryItems.length === 0) {
    galleryItems.push({ type: "image", content: product.image || placeholderImage });
  }

  const currentGalleryItem = galleryItems[currentImageIndex] || galleryItems[0];
  const availableSizes = selectedColorData?.sizes || [];

  const handleAddToCart = () => {
    if (selectedSize && selectedColor && selectedColorData) {
      const cartImage = regularImages[0] || product.image;
      onAddToCart(product.id, selectedSize, selectedColor, selectedColorData.id, quantity, cartImage);
      onClose();
    }
  };

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? galleryItems.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev === galleryItems.length - 1 ? 0 : prev + 1));
  };

  const selectedSizeData = availableSizes.find((s) => s.name === selectedSize);
  const selectedSizeStock = selectedSizeData?.stock || 0;
  const enforceStockLimit = product.justStock === "yes";
  const quantityAlreadyInCart = cartItems
    .filter((item) => item.productId === product.id && item.colorId === selectedColorData?.id && item.size === selectedSize)
    .reduce((sum, item) => sum + item.quantity, 0);
  const remainingStock = Math.max(0, selectedSizeStock - quantityAlreadyInCart);
  const maxSelectableQuantity = enforceStockLimit ? remainingStock : Infinity;
  const canAddToCart = selectedSize && selectedColor && (!enforceStockLimit || (remainingStock > 0 && quantity <= remainingStock));

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="absolute top-1/2 left-1/2 w-[95vw] max-w-4xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-white shadow-xl sm:w-full">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white p-3 sm:p-4">
          <h2 className="text-lg font-semibold sm:text-xl">{product.name}</h2>
          <button onClick={onClose} className="rounded-full p-1 transition-colors hover:bg-muted">
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:gap-8 sm:p-6">
          <div className="min-w-0 flex-1">
            <div className="relative mb-4 rounded-lg bg-product-card p-4 sm:p-8">
              {galleryItems.length > 1 && (
                <>
                  <button onClick={handlePrevImage} className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-1.5 shadow-lg transition-colors hover:bg-white/90 sm:left-4 sm:p-2">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={handleNextImage} className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-1.5 shadow-lg transition-colors hover:bg-white/90 sm:right-4 sm:p-2">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}

              {currentGalleryItem.type === "3d" ? (
                <div
                  className="h-48 w-full sm:h-64 [&>div]:h-full [&>div]:w-full [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:rounded-lg [&_p]:hidden"
                  dangerouslySetInnerHTML={{ __html: currentGalleryItem.content }}
                />
              ) : (
                <img src={currentGalleryItem.content} alt={`${product.name} - ${selectedColor}`} className="h-48 w-full object-contain sm:h-64" />
              )}

              {galleryItems.length > 1 && (
                <div className="mt-3 flex justify-center gap-2 sm:mt-4">
                  {galleryItems.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={cn("h-2 w-2 rounded-full transition-all", index === currentImageIndex ? "w-6 bg-primary" : "bg-muted")}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-4 sm:space-y-6">
            <div>
              <h3 className="mb-2 text-xl font-semibold sm:text-2xl">{product.name}</h3>
              <p className="text-xl font-bold sm:text-2xl">CHF {product.price.toFixed(2)}</p>
            </div>

            {product.description && product.description.trim() !== "" && (
              <div className="text-sm text-muted-foreground">
                {product.description.includes("<") && product.description.includes(">") ? (
                  <div dangerouslySetInnerHTML={{ __html: product.description }} />
                ) : (
                  <p>{product.description}</p>
                )}
              </div>
            )}

            <div>
              <h4 className="mb-3 text-sm font-medium text-muted-foreground">{t("selectColor")}</h4>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {product.colors.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => setSelectedColor(color.name)}
                    className={cn(
                      "flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded border-2 p-1 transition-all sm:h-16 sm:w-16",
                      selectedColor === color.name ? "border-primary" : "border-border hover:border-muted-foreground",
                    )}
                  >
                    <div className="h-6 w-6 rounded-sm sm:h-8 sm:w-8" style={{ backgroundColor: color.code }} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-medium text-muted-foreground">{t("selectSize")}</h4>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {availableSizes.map((size) => {
                  const alreadyInCart = cartItems
                    .filter((item) => item.productId === product.id && item.colorId === selectedColorData?.id && item.size === size.name)
                    .reduce((sum, item) => sum + item.quantity, 0);
                  const displayStock = enforceStockLimit ? Math.max(0, size.stock - alreadyInCart) : size.stock;

                  return (
                    <button
                      key={size.name}
                      onClick={() => setSelectedSize(size.name)}
                      disabled={enforceStockLimit && (displayStock === 0 || size.stock == null)}
                      className={cn(
                        "flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded border transition-all sm:h-16 sm:w-16",
                        selectedSize === size.name ? "border-primary bg-primary text-primary-foreground" : "border-border bg-size-button hover:border-muted-foreground",
                        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border",
                      )}
                    >
                      <span className="text-xs font-medium sm:text-sm">{size.name}</span>
                      {(enforceStockLimit && size.stock != null || (size.stock != null && (size.stock > 0 || size.justStock === "yes"))) && (
                        <span className="text-[10px] sm:text-xs">{displayStock} {t("left")}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-medium text-muted-foreground">{t("quantity")}</h4>
              <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => setQuantity((prev) => Math.max(1, prev - 1))} disabled={quantity <= 1} className="h-10 w-10">
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="min-w-[3ch] text-center text-xl font-semibold">{quantity}</span>
                <Button variant="outline" size="icon" onClick={() => setQuantity((prev) => prev + 1)} disabled={enforceStockLimit && quantity >= maxSelectableQuantity} className="h-10 w-10">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button onClick={handleAddToCart} disabled={!canAddToCart} variant="shop" className="w-full py-2.5 text-sm font-medium sm:py-3 sm:text-base">
              {t("addToCart")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
