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
      className={`bg-product-card rounded-lg p-4 cursor-pointer transition-transform hover:scale-105 relative ${
        isSoldOut ? 'opacity-80' : ''
      }`}
      onClick={() => onProductClick(product)}
    >
      <div className="aspect-square mb-4 flex items-center justify-center bg-white rounded-lg overflow-hidden relative">
        <img
          src={product.image}
          alt={product.name}
          className={`w-full h-full object-contain ${isSoldOut ? 'opacity-60' : ''}`}
        />
        {isSoldOut && (
          <div className="absolute top-2 right-2 bg-muted/90 backdrop-blur-sm text-muted-foreground px-3 py-1 rounded-md text-xs font-medium border border-border">
            Sold Out
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