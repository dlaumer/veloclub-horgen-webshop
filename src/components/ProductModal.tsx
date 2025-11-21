import React, { useState } from "react";
import { X, ChevronLeft, ChevronRight, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Product } from "@/types/shop";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

interface ProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (productId: string, size: string, color: string, colorId: string, quantity: number) => void;
}

export const ProductModal = ({ product, isOpen, onClose, onAddToCart }: ProductModalProps) => {
  const { t } = useTranslation();
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // Initialize selections when product changes - MUST be before conditional returns
  React.useEffect(() => {
    if (product) {
      setSelectedColor(product.colors[0]?.name || '');
      setSelectedSize('');
      setCurrentImageIndex(0);
      setQuantity(1);
    }
  }, [product]);

  // Reset image index when color changes
  React.useEffect(() => {
    setCurrentImageIndex(0);
  }, [selectedColor]);

  // Auto-select size if there's only one available
  React.useEffect(() => {
    if (product && selectedColor) {
      const colorData = product.colors.find(c => c.name === selectedColor);
      if (colorData) {
        const allSizes = colorData.sizes || [];
        const oneSizeOption = allSizes.find(s => s.name === 'ONESIZE');
        const hasOneSizeAvailable = oneSizeOption && oneSizeOption.stock !== null;
        
        const availableSizes = hasOneSizeAvailable 
          ? [oneSizeOption] 
          : allSizes.filter(s => s.name !== 'ONESIZE');
        
        if (availableSizes.length === 1) {
          setSelectedSize(availableSizes[0].name);
        }
      }
    }
  }, [product, selectedColor]);

  if (!isOpen || !product) return null;

  const selectedColorData = product.colors.find(c => c.name === selectedColor);
  const currentImages = selectedColorData?.images || [product.image];
  const currentImage = currentImages[currentImageIndex] || product.image;
  
  // Filter sizes: if ONESIZE exists with non-null stock, only show it; otherwise show all other sizes
  const allSizes = selectedColorData?.sizes || [];
  const oneSizeOption = allSizes.find(s => s.name === 'ONESIZE');
  const hasOneSizeAvailable = oneSizeOption && oneSizeOption.stock !== null;
  
  const availableSizes = hasOneSizeAvailable 
    ? [oneSizeOption] 
    : allSizes.filter(s => s.name !== 'ONESIZE');

  const handleAddToCart = () => {
    if (selectedSize && selectedColor && selectedColorData) {
      onAddToCart(product.id, selectedSize, selectedColor, selectedColorData.id, quantity);
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
      prev === 0 ? currentImages.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    setCurrentImageIndex(prev =>
      prev === currentImages.length - 1 ? 0 : prev + 1
    );
  };

  const selectedSizeData = availableSizes.find(s => s.name === selectedSize);
  const selectedSizeStock = selectedSizeData?.stock || 0;
  const selectedSizeJustStock = product?.justStock;
  const enforceStockLimit = selectedSizeJustStock == 'yes';
  console.log(product)
  const canAddToCart = selectedSize && selectedColor && (!enforceStockLimit || quantity <= selectedSizeStock);

  return (
    <div className="fixed inset-0 z-50">
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
          {/* Image Section */}
          <div className="flex-1 min-w-0">
            <div className="relative bg-product-card rounded-lg p-4 sm:p-8 mb-4">
              {currentImages.length > 1 && (
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

              <img
                src={currentImage}
                alt={`${product.name} - ${selectedColor}`}
                className="w-full h-48 sm:h-64 object-contain"
              />

              {/* Navigation dots */}
              {currentImages.length > 1 && (
                <div className="flex justify-center mt-3 sm:mt-4 gap-2">
                  {currentImages.map((_, index) => (
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
                    disabled={enforceStockLimit && size.stock === 0 || size.stock == null}
                    className={cn(
                      "w-14 h-14 sm:w-16 sm:h-16 rounded border transition-all flex-shrink-0 flex flex-col items-center justify-center",
                      selectedSize === size.name
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-size-button hover:border-muted-foreground"
                    )}
                  >
                    <span className="text-xs sm:text-sm font-medium">{size.name}</span>
                    {(enforceStockLimit && size.stock!=null || (size.stock != null && (size.stock > 0 || size.justStock === 'yes'))) && (
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