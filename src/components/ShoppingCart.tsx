import { ShoppingCart as ShoppingCartIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartItem } from "@/types/shop";
import { useTranslation } from "@/hooks/useTranslation";

interface ShoppingCartProps {
  items: CartItem[];
  isOpen: boolean;
  onToggle: () => void;
  onRemoveItem: (itemId: string) => void;
  onCheckout: () => void;
}

export const ShoppingCart = ({ 
  items, 
  isOpen, 
  onToggle, 
  onRemoveItem, 
  onCheckout 
}: ShoppingCartProps) => {
  const { t } = useTranslation();
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const delivery = 10.00;
  const total = subtotal + delivery;

  return (
    <>
      {/* Cart Button */}
      <button
        onClick={onToggle}
        className="fixed top-4 right-4 z-50 flex items-center justify-center w-12 h-12 bg-button-primary text-button-primary-foreground rounded-full shadow-lg hover:scale-105 transition-transform"
      >
        <ShoppingCartIcon className="h-5 w-5" />
        {totalItems > 0 && (
          <span className="absolute -top-2 -right-2 bg-accent text-accent-foreground text-xs rounded-full w-6 h-6 flex items-center justify-center font-semibold">
            {totalItems}
          </span>
        )}
      </button>

      {/* Cart Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40">
          <div 
            className="absolute inset-0 bg-black bg-opacity-50" 
            onClick={onToggle}
          />
          <div className="absolute right-0 top-0 h-full w-full sm:w-96 bg-cart-overlay shadow-xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold">{t('cart')}</h2>
              <button
                onClick={onToggle}
                className="p-1 hover:bg-muted rounded-full transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4">
              {items.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t('yourCartIsEmpty')}</p>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-16 h-16 object-contain bg-product-card rounded"
                      />
                      <div className="flex-1">
                        <h3 className="font-medium text-sm">{item.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          Size: {item.size}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Colour: {item.color}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Amount: {item.quantity}
                        </p>
                        <p className="font-semibold text-sm mt-1">
                          CHF {item.price.toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Summary */}
            {items.length > 0 && (
              <div className="border-t border-border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t('subtotal')}</span>
                  <span>CHF {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{t('delivery')}</span>
                  <span>CHF {delivery.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>{t('total')}</span>
                  <span>CHF {total.toFixed(2)}</span>
                </div>
                
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span>We accept</span>
                    <div className="flex items-center gap-1 text-button-primary font-semibold">
                      <div className="w-6 h-4 bg-button-primary rounded-sm flex items-center justify-center">
                        <span className="text-button-primary-foreground text-xs font-bold">T</span>
                      </div>
                      TWINT
                    </div>
                  </div>
                  
                  <Button 
                    onClick={onCheckout}
                    className="w-full bg-button-primary hover:bg-button-primary/90 text-button-primary-foreground"
                  >
                    Pay
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};