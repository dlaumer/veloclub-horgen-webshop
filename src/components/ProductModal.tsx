import React, { useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Product } from "@/types/shop";
import { cn } from "@/lib/utils";

interface ProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (productId: string, size: string, color: string) => void;
}

export const ProductModal = ({ product, isOpen, onClose, onAddToCart }: ProductModalProps) => {
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Initialize selections when product changes - MUST be before conditional returns
  React.useEffect(() => {
    if (product) {
      setSelectedColor(product.colors[0]?.name || '');
      setSelectedSize('');
      setCurrentImageIndex(0);
    }
  }, [product]);

  // Reset image index when color changes
  React.useEffect(() => {
    setCurrentImageIndex(0);
  }, [selectedColor]);

  if (!isOpen || !product) return null;

  const selectedColorData = product.colors.find(c => c.name === selectedColor);
  const currentImages = selectedColorData?.images || [product.image];
  const currentImage = currentImages[currentImageIndex] || product.image;

  const handleAddToCart = () => {
    if (selectedSize && selectedColor) {
      onAddToCart(product.id, selectedSize, selectedColor);
      onClose();
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

  const selectedSizeStock = product.sizes.find(s => s.name === selectedSize)?.stock || 0;
  const canAddToCart = selectedSize && selectedColor && selectedSizeStock > 0;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-semibold">{product.name}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex p-6 gap-8">
          {/* Image Section */}
          <div className="flex-1">
            <div className="relative bg-product-card rounded-lg p-8 mb-4">
              {currentImages.length > 1 && (
                <>
                  <button
                    onClick={handlePrevImage}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-2 rounded-full bg-white/80 hover:bg-white/90 transition-colors shadow-lg"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleNextImage}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-2 rounded-full bg-white/80 hover:bg-white/90 transition-colors shadow-lg"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}

              <img
                src={currentImage}
                alt={`${product.name} - ${selectedColor}`}
                className="w-full h-64 object-contain"
              />

              {/* Navigation dots */}
              {currentImages.length > 1 && (
                <div className="flex justify-center mt-4 gap-2">
                  {currentImages.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={cn(
                        "w-2 h-2 rounded-full border! transition-colors",
                        index === currentImageIndex ? "bg-primary" : "bg-muted"
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Details Section */}
          <div className="flex-1 space-y-6 w-half max-w-md">
            <div>
              <h3 className="text-2xl font-semibold mb-2">{product.name}</h3>
              <p className="text-2xl font-bold">CHF {product.price.toFixed(2)}</p>
            </div>

            {/* Color Selection */}
            <div>
              <h4 className="text-sm font-medium mb-3 text-muted-foreground">Choose colour</h4>
              <div className="flex gap-2">
                {product.colors.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => setSelectedColor(color.name)}
                    className={cn(
                      "w-16 h-16 rounded border-2 transition-all flex flex-col items-center justify-center p-1",
                      selectedColor === color.name
                        ? "border-primary"
                        : "border-border hover:border-muted-foreground"
                    )}
                  >
                    <div
                      className="w-8 h-8 rounded-sm"
                      style={{ backgroundColor: color.code }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Size Selection */}
            <div>
              <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                Choose size
              </h4>
              <div className="flex gap-2 overflow-x-auto pb-2 max-w-full">
                {product.sizes.map((size) => (
                  <button
                    key={size.name}
                    onClick={() => setSelectedSize(size.name)}
                    disabled={size.stock === 0}
                    className={cn(
                      "w-16 h-16 rounded border transition-all flex-shrink-0 flex flex-col items-center justify-center",
                      size.stock === 0
                        ? "border-border bg-muted text-muted-foreground cursor-not-allowed"
                        : selectedSize === size.name
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-size-button hover:border-muted-foreground"
                    )}
                  >
                    <span className="text-sm font-medium">{size.name}</span>
                    <span className="text-xs">{size.stock} left</span>
                  </button>
                ))}
              </div>
            </div>


            {/* Add to Cart Button */}
            <Button
              onClick={handleAddToCart}
              disabled={!canAddToCart}
              className="w-full bg-button-primary hover:bg-button-primary/90 text-button-primary-foreground py-3 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add to cart
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};