export type Language = 'en' | 'de';

export type TranslationKey = keyof typeof translations;

export const translations = {
  all: {
    en: "All",
    de: "Alle"
  },
  men: {
    en: "Men",
    de: "Herren"
  },
  women: {
    en: "Women",
    de: "Damen"
  },
  kids: {
    en: "Kids",
    de: "Kinder"
  },
  soldOut: {
    en: "Sold Out",
    de: "Ausverkauft"
  },
  selectColor: {
    en: "Select Color",
    de: "Farbe wählen"
  },
  selectSize: {
    en: "Select Size",
    de: "Größe wählen"
  },
  addToCart: {
    en: "Add to Cart",
    de: "In den Warenkorb"
  },
  outOfStock: {
    en: "Out of stock",
    de: "Nicht auf Lager"
  },
  cart: {
    en: "Cart",
    de: "Warenkorb"
  },
  shoppingCart: {
    en: "Shopping Cart",
    de: "Warenkorb"
  },
  remove: {
    en: "Remove",
    de: "Entfernen"
  },
  subtotal: {
    en: "Subtotal",
    de: "Zwischensumme"
  },
  delivery: {
    en: "Delivery",
    de: "Lieferung"
  },
  total: {
    en: "Total",
    de: "Gesamt"
  },
  proceedToCheckout: {
    en: "Proceed to Checkout",
    de: "Zur Kasse"
  },
  yourCartIsEmpty: {
    en: "Your cart is empty",
    de: "Ihr Warenkorb ist leer"
  }
};
