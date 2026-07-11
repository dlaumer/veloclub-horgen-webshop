import { CartItem } from "@/types/shop";

export type DiscountedCartItem = CartItem & {
  returnDiscount: number;
  isFreeByReturnPromo: boolean;
};

const NO_RETURN_CATEGORY = "no";

export function normalizeReturnCategory(category?: string | null) {
  const normalized = String(category || "").trim().toLowerCase();
  return normalized && normalized !== NO_RETURN_CATEGORY ? normalized : "";
}

export function calculateReturnPromoDiscounts(items: CartItem[], isPromoApplied: boolean): DiscountedCartItem[] {
  const discountedItems = items.map((item) => ({
    ...item,
    returnDiscount: 0,
    isFreeByReturnPromo: false,
  }));

  if (!isPromoApplied) return discountedItems;

  const cheapestByCategory = new Map<string, number>();

  discountedItems.forEach((item, index) => {
    const category = normalizeReturnCategory(item.returnCategory);
    if (!category || item.quantity <= 0) return;

    const currentIndex = cheapestByCategory.get(category);
    if (currentIndex == null || item.price < discountedItems[currentIndex].price) {
      cheapestByCategory.set(category, index);
    }
  });

  cheapestByCategory.forEach((index) => {
    discountedItems[index].returnDiscount = discountedItems[index].price;
    discountedItems[index].isFreeByReturnPromo = true;
  });

  return discountedItems;
}

export function calculateCartTotals(items: CartItem[], isPromoApplied: boolean) {
  const discountedItems = calculateReturnPromoDiscounts(items, isPromoApplied);
  const subtotal = discountedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const returnDiscount = discountedItems.reduce((sum, item) => sum + item.returnDiscount, 0);

  return {
    discountedItems,
    subtotal,
    returnDiscount,
    total: subtotal - returnDiscount,
  };
}
