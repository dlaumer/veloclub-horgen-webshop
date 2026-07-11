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
  others: {
    en: "Other",
    de: "Anderes"
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
    en: "in stock",
    de: "auf Lager"
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
  processing: {
    en: "Processing...",
    de: "Wird verarbeitet..."
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
  reserve: {
    en: "Reserve for free",
    de: "Kostenlos bestellen"
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
    en: "Proceed",
    de: "Weiter"
  },
  fillAllFields: {
    en: "Please fill in all fields",
    de: "Bitte alle Felder ausfüllen"
  },
  invalidEmail: {
    en: "Invalid email address",
    de: "Ungültige E-Mail-Adresse"
  },
  filterBy: {
    en: "Filter by",
    de: "Filtern nach"
  },
  velokleider: {
    en: "Cycling Apparel",
    de: "Velokleider"
  },
  casual: {
    en: "Casual",
    de: "Casual"
  },
  thomus: {
    en: "Thömus Bike & Parts",
    de: "Thömus Bike & Parts"
  },
  vch: {
    en: "VCH Bike & Parts",
    de: "VCH Bike & Parts"
  },
  sonderkationen: {
    en: "Special Discounts",
    de: "Sonderaktionen"
  },
  thankYouTitle: {
    en: "Thank you for your order! 🎉",
    de: "Vielen Dank für Ihre Bestellung! 🎉"
  },
  loading: {
    en: "Loading your order…",
    de: "Ihre Bestellung wird geladen…"
  },
  noSessionId: {
    en: "No session ID provided.",
    de: "Keine Sitzungs-ID vorhanden."
  },
  somethingWentWrong: {
    en: "Something went wrong:",
    de: "Etwas ist schief gelaufen:"
  },
  orderId: {
    en: "Order ID:",
    de: "Bestellnummer:"
  },
  amountLabel: {
    en: "Amount:",
    de: "Betrag:"
  },
  confirmationEmailSent: {
    en: "A confirmation email has been sent to",
    de: "Eine Bestätigungs-E-Mail wurde gesendet an"
  },
  continueShopping: {
    en: "Continue Shopping",
    de: "Weiter einkaufen"
  },
  paymentCancelled: {
    en: "Payment cancelled",
    de: "Zahlung abgebrochen"
  },
  paymentNotCompleted: {
    en: "Your payment was not completed, so no order was placed.",
    de: "Ihre Zahlung wurde nicht abgeschlossen, daher wurde keine Bestellung aufgegeben."
  },
  tryAgainLater: {
    en: "You can go back to the shop and try again whenever you're ready.",
    de: "Sie können zum Shop zurückkehren und es erneut versuchen, wann immer Sie bereit sind."
  },
  reason: {
    en: "Reason:",
    de: "Grund:"
  },
  session: {
    en: "Session:",
    de: "Sitzung:"
  },
  backToShop: {
    en: "Back to Shop",
    de: "Zurück zum Shop"
  },
  quantity: {
    en: "Quantity",
    de: "Anzahl"
  },
  maxAvailable: {
    en: "Max in stock",
    de: "Max. auf Lager"
  },
  returnDiscount: {
    en: "Promocde discount",
    de: "Promocode-Rabatt"
  },
  freeItem: {
    en: "(1 Free with Promocode)",
    de: "(1 Gratis mit Promocode)"
  },
  returnAlreadyUsed: {
    en: "Return already used",
    de: "Rückgabe bereits verwendet"
  },
  thankYouReceived: {
    en: "We have received your order.",
    de: "Wir haben Ihre Bestellung erhalten."
  },
  thankYouEmailSoon: {
    en: "You should receive a confirmation email with all details shortly.",
    de: "In Kürze sollten Sie eine Bestätigungs-E-Mail mit allen Details erhalten."
  },
  thankYouContact: {
    en: "If you do not receive an email or have any questions, please contact us.",
    de: "Falls Sie keine E-Mail erhalten oder Fragen haben, melden Sie sich bitte bei uns."
  },
  kidzbike: {
    en: "KidzBike leader and/or RoadKidz without item return",
    de: "Leiter*in KidzBike und/oder RoadKidz ohne Kleiderrückgabe"
  },
  comments: {
    en: "Comments",
    de: "Bemerkungen"
  },
  promoCode: {
    en: "Promo code",
    de: "Promocode"
  },
  apply: {
    en: "Apply",
    de: "Einlösen"
  },
  invalidPromoCode: {
    en: "Invalid promo code",
    de: "Ungültiger Promocode"
  },
  promoCodeApplied: {
    en: "Promo code applied",
    de: "Promocode eingelöst"
  }

};
