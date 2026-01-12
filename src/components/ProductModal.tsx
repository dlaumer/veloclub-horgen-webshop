import React, { useState } from "react";
import { X, ChevronLeft, ChevronRight, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Product } from "@/types/shop";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

interface ProductModalProps {
  product: Product | null;
  isOpen: boolean;
  returnAlreadyUsed: boolean;
  onClose: () => void;
  onAddToCart: (productId: string, size: string, color: string, colorId: string, quantity: number, image: string, isReturn?: boolean) => void;
}

export const ProductModal = ({ product, isOpen, returnAlreadyUsed, onClose, onAddToCart }: ProductModalProps) => {
  const { t } = useTranslation();
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isReturn, setIsReturn] = useState(false);

  // Initialize selections when product changes - MUST be before conditional returns
  React.useEffect(() => {
    if (product) {
      setSelectedColor(product.colors[0]?.name || '');
      setSelectedSize('');
      setCurrentImageIndex(0);
      setQuantity(1);
      setIsReturn(false);
    }
  }, [product]);

  // Reset image index when color changes
  React.useEffect(() => {
    setCurrentImageIndex(0);
  }, [selectedColor]);

  // Auto-select size if there's only one available
  // Auto-select size if only one is available
  React.useEffect(() => {
    if (product && selectedColor) {
      const colorData = product.colors.find(c => c.name === selectedColor);
      if (colorData) {
        const sizes = colorData.sizes || [];
        if (sizes.length === 1) {
          setSelectedSize(sizes[0].name);
        }
      }
    }
  }, [product, selectedColor]);

  if (!isOpen || !product) return null;

  const selectedColorData = product.colors.find(c => c.name === selectedColor);
  
  // Parse images - handle both array and string formats
  let regularImages: string[] = [];
  const rawImages: unknown = selectedColorData?.images;
  if (Array.isArray(rawImages)) {
    regularImages = rawImages.filter(Boolean);
  } else if (typeof rawImages === 'string' && rawImages.trim()) {
    // Handle string that might be JSON array or comma-separated
    const trimmed = rawImages.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        regularImages = Array.isArray(parsed) ? parsed.filter(Boolean) : [trimmed];
      } catch {
        regularImages = [trimmed];
      }
    } else {
      // Comma-separated URLs
      regularImages = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  const placeholderImage = '/placeholder.svg';
  
  if (regularImages.length === 0 && product.image) {
    regularImages = [product.image];
  }
  
  // Build gallery items: if image3d exists on the selected color, add it as the first item
  const image3dValue = selectedColorData?.image3d;
  const has3dEmbed = image3dValue && typeof image3dValue === 'string' && image3dValue.trim() !== '';
  const galleryItems: Array<{ type: '3d' | 'image'; content: string }> = [];
  
  if (has3dEmbed) {
    galleryItems.push({ type: '3d', content: image3dValue });
  }
  regularImages.forEach(img => {
    galleryItems.push({ type: 'image', content: img });
  });
  
  // Ensure we always have at least a fallback placeholder
  if (galleryItems.length === 0) {
    galleryItems.push({ type: 'image', content: product.image || placeholderImage });
  }
  
  const currentGalleryItem = galleryItems[currentImageIndex] || galleryItems[0];
  
  // Show all sizes provided for the selected color
  const availableSizes = selectedColorData?.sizes || [];
  // Check if product is eligible for return exchange
  const isReturnEligible = product.isReturn === 'yes';

  const handleAddToCart = () => {
    if (selectedSize && selectedColor && selectedColorData) {
      // Use the first regular image for the cart, not the 3D embed
      const cartImage = regularImages[0] || product.image;
      onAddToCart(product.id, selectedSize, selectedColor, selectedColorData.id, quantity, cartImage, isReturn);
      onClose();
    }
  };

  const handleIncreaseQuantity = () => {
    setQuantity(prev => prev + 1);
  };

  const handleDecreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  const handlePrevImage = () => {
    setCurrentImageIndex(prev =>
      prev === 0 ? galleryItems.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    setCurrentImageIndex(prev =>
      prev === galleryItems.length - 1 ? 0 : prev + 1
    );
  };

  const selectedSizeData = availableSizes.find(s => s.name === selectedSize);
  const selectedSizeStock = selectedSizeData?.stock || 0;
  const selectedSizeJustStock = product?.justStock;
  const enforceStockLimit = selectedSizeJustStock == 'yes';
  console.log(product)
  const canAddToCart = selectedSize && selectedColor && (!enforceStockLimit || quantity <= selectedSizeStock);

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl w-[95vw] sm:w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-3 sm:p-4 border-b border-border">
          <h2 className="text-lg sm:text-xl font-semibold">{product.name}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row p-4 sm:p-6 gap-4 sm:gap-8">
          {/* Image/3D Section */}
          <div className="flex-1 min-w-0">
            <div className="relative bg-product-card rounded-lg p-4 sm:p-8 mb-4">
              {galleryItems.length > 1 && (
                <>
                  <button
                    onClick={handlePrevImage}
                    className="absolute left-1 sm:left-4 top-1/2 transform -translate-y-1/2 z-10 p-1.5 sm:p-2 rounded-full bg-white/80 hover:bg-white/90 transition-colors shadow-lg"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleNextImage}
                    className="absolute right-1 sm:right-4 top-1/2 transform -translate-y-1/2 z-10 p-1.5 sm:p-2 rounded-full bg-white/80 hover:bg-white/90 transition-colors shadow-lg"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}

              {currentGalleryItem.type === '3d' ? (
                <div 
                  className="w-full h-48 sm:h-64 [&>div]:w-full [&>div]:h-full [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:rounded-lg [&_p]:hidden"
                  dangerouslySetInnerHTML={{ __html: currentGalleryItem.content }}
                />
              ) : (
                <img
                  src={currentGalleryItem.content}
                  alt={`${product.name} - ${selectedColor}`}
                  className="w-full h-48 sm:h-64 object-contain"
                />
              )}

              {/* Navigation dots */}
              {galleryItems.length > 1 && (
                <div className="flex justify-center mt-3 sm:mt-4 gap-2">
                  {galleryItems.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all",
                        index === currentImageIndex ? "bg-primary w-6" : "bg-muted"
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Details Section */}
          <div className="flex-1 space-y-4 sm:space-y-6 min-w-0">
            <div>
              <h3 className="text-xl sm:text-2xl font-semibold mb-2">{product.name}</h3>
              <p className="text-xl sm:text-2xl font-bold">CHF {product.price.toFixed(2)}</p>
            </div>

            {/* Description */}
            {product.description && product.description.trim() !== '' && (
              <div className="text-sm text-muted-foreground">
                {product.description.includes('<') && product.description.includes('>') ? (
                  <div dangerouslySetInnerHTML={{ __html: product.description }} />
                ) : (
                  <p>{product.description}</p>
                )}
              </div>
            )}

            {/* Color Selection */}
            <div>
              <h4 className="text-sm font-medium mb-3 text-muted-foreground">{t('selectColor')}</h4>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {product.colors.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => setSelectedColor(color.name)}
                    className={cn(
                      "w-14 h-14 sm:w-16 sm:h-16 rounded border-2 transition-all flex flex-col items-center justify-center p-1 flex-shrink-0",
                      selectedColor === color.name
                        ? "border-primary"
                        : "border-border hover:border-muted-foreground"
                    )}
                  >
                    <div
                      className="w-6 h-6 sm:w-8 sm:h-8 rounded-sm"
                      style={{ backgroundColor: color.code }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Size Selection */}
            <div>
              <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                {t('selectSize')}
              </h4>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {availableSizes.map((size) => (
                  <button
                    key={size.name}
                    onClick={() => setSelectedSize(size.name)}
                    disabled={enforceStockLimit && (size.stock === 0 || size.stock == null)}
                    className={cn(
                      "w-14 h-14 sm:w-16 sm:h-16 rounded border transition-all flex-shrink-0 flex flex-col items-center justify-center",
                      selectedSize === size.name
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-size-button hover:border-muted-foreground",
                      "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border"
                    )}
                  >
                    <span className="text-xs sm:text-sm font-medium">{size.name}</span>
                    {(enforceStockLimit && size.stock != null || (size.stock != null && (size.stock > 0 || size.justStock === 'yes'))) && (
                      <span className="text-[10px] sm:text-xs">{size.stock} {t('left')}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity Selection */}
            <div>
              <h4 className="text-sm font-medium mb-3 text-muted-foreground">{t('quantity')}</h4>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleDecreaseQuantity}
                  disabled={quantity <= 1}
                  className="h-10 w-10"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-xl font-semibold min-w-[3ch] text-center">{quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleIncreaseQuantity}
                  disabled={enforceStockLimit && quantity >= selectedSizeStock}
                  className="h-10 w-10"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Return Old Item Checkbox */}
            {isReturnEligible && (
              <div
                className={[
                  "flex items-center space-x-3 p-3 bg-muted/50 rounded-lg border border-border rounded-lg",
                  returnAlreadyUsed && !isReturn ? "opacity-50" : "",
                ].join(" ")}
              >
                <Checkbox
                  id="return-checkbox"
                  checked={isReturn}
                  disabled={returnAlreadyUsed && !isReturn} // ✅ block enabling if already used
                  onCheckedChange={(checked) => {
                    // extra guard (in case disabled style isn't respected somewhere)
                    if (returnAlreadyUsed && !isReturn) return;
                    setIsReturn(checked === true);
                  }}
                />

                {/* If disabled, don't use htmlFor (otherwise clicking label still toggles) */}
                {returnAlreadyUsed && !isReturn ? (
                  <span className="text-sm font-medium leading-none select-none">
                    {t("returnOldItem")}
                  </span>
                ) : (
                  <label
                    htmlFor="return-checkbox"
                    className="text-sm font-medium leading-none cursor-pointer select-none"
                  >
                    {t("returnOldItem")}
                  </label>
                )}

                {returnAlreadyUsed && !isReturn && (
                  <div className="text-xs text-muted-foreground">
                    {t("returnAlreadyUsed")} {/* add this key in your translations */}
                  </div>
                )}
              </div>
            )}


            {/* Add to Cart Button */}
            <Button
              onClick={handleAddToCart}
              disabled={!canAddToCart}
              variant="shop"
              className="w-full py-2.5 sm:py-3 text-sm sm:text-base font-medium"
            >
              {t('addToCart')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};