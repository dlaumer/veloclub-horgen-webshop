import { Product } from "@/types/shop";

interface ProductCardProps {
  product: Product;
  onProductClick: (product: Product) => void;
}

export const ProductCard = ({ product, onProductClick }: ProductCardProps) => {
  return (
    <div 
      className="bg-product-card rounded-lg p-4 cursor-pointer transition-transform hover:scale-105"
      onClick={() => onProductClick(product)}
    >
      <div className="aspect-square mb-4 flex items-center justify-center bg-white rounded-lg overflow-hidden">
        <img
          src={product.image}
          alt={product.image}
          className="w-full h-full object-contain"
        />
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