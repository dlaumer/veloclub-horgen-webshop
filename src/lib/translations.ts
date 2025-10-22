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
  },
  left: {
    en: "left",
    de: "verfügbar"
  },
  addedToCart: {
    en: "Added to cart",
    de: "Zum Warenkorb hinzugefügt"
  },
  hasBeenAddedToCart: {
    en: "has been added to your cart.",
    de: "wurde zu Ihrem Warenkorb hinzugefügt."
  },
  proceedingToTwint: {
    en: "Proceeding to TWINT",
    de: "Weiter zu TWINT"
  },
  redirectToTwint: {
    en: "You will be redirected to TWINT for payment.",
    de: "Sie werden zur Zahlung zu TWINT weitergeleitet."
  },
  size: {
    en: "Size",
    de: "Größe"
  },
  colour: {
    en: "Colour",
    de: "Farbe"
  },
  amount: {
    en: "Amount",
    de: "Menge"
  },
  weAccept: {
    en: "We accept",
    de: "Wir akzeptieren"
  },
  pay: {
    en: "Pay",
    de: "Bezahlen"
  },
  updatingStock: {
    en: "Updating stock…",
    de: "Bestand wird aktualisiert…"
  },
  success: {
    en: "Success",
    de: "Erfolg"
  },
  stockUpdated: {
    en: "Stock has been updated.",
    de: "Der Bestand wurde aktualisiert."
  },
  error: {
    en: "Error",
    de: "Fehler"
  },
  checkout: {
    en: "Checkout",
    de: "Zur Kasse"
  },
  contactDetails: {
    en: "Contact Details",
    de: "Kontaktdaten"
  },
  name: {
    en: "Name",
    de: "Name"
  },
  lastName: {
    en: "Last name",
    de: "Nachname"
  },
  email: {
    en: "Email",
    de: "E-Mail"
  },
  address: {
    en: "Address",
    de: "Adresse"
  },
  street: {
    en: "Street",
    de: "Straße"
  },
  city: {
    en: "City",
    de: "Stadt"
  },
  postalCode: {
    en: "Postal Code",
    de: "Postleitzahl"
  },
  country: {
    en: "Country",
    de: "Land"
  },
  proceedToPayment: {
    en: "Proceed to Payment",
    de: "Zur Zahlung"
  },
  fillAllFields: {
    en: "Please fill in all fields",
    de: "Bitte alle Felder ausfüllen"
  },
  invalidEmail: {
    en: "Invalid email address",
    de: "Ungültige E-Mail-Adresse"
  }
};
