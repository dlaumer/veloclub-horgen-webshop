import { Product } from "@/types/shop";

interface ProductCardProps {
  product: Product;
  onProductClick: (product: Product) => void;
}

export const ProductCard = ({ product, onProductClick }: ProductCardProps) => {
  // Check if product is completely sold out (no stock in any size for any color)
  const isSoldOut = product.colors.every(color => 
    color.sizes.every(size => size.stock === 0)
  );

  return (
    <div 
      className={`bg-product-card rounded-lg p-4 transition-transform relative ${
        isSoldOut ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer hover:scale-105'
      }`}
      onClick={() => !isSoldOut && onProductClick(product)}
    >
      <div className="aspect-square mb-4 flex items-center justify-center bg-white rounded-lg overflow-hidden relative">
        <img
          src={product.image}
          alt={product.name}
          className={`w-full h-full object-contain ${isSoldOut ? 'grayscale' : ''}`}
        />
        {isSoldOut && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md font-semibold text-sm">
              SOLD OUT
            </div>
          </div>
        )}
      </div>
      
      <h3 className="font-medium text-product-card-foreground mb-2 text-sm">
        {product.name}
      </h3>
      
      <div className="text-lg font-semibold text-product-card-foreground mb-3">
        CHF {product.price.toFixed(2)}
      </div>
      
      <div className="flex space-x-2">
        {product.colors.map((color, index) => (
          <div
            key={index}
            className="w-4 h-4 rounded-sm border border-border"
            style={{ backgroundColor: color.code }}
          />
        ))}
      </div>
    </div>
  );
};