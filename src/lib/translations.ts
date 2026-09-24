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
  },
  promoCheckingCode: {
    en: "Checking…",
    de: "Wird geprüft…"
  },
  promoFreeOrderApplied: {
    en: "Your entire order is free with this promo code.",
    de: "Deine ganze Bestellung ist mit diesem Promocode gratis."
  },
  promoPercentageDiscount: {
    en: "Promo code discount",
    de: "Promocode-Rabatt"
  },

  // --- Admin dashboard (/admin) ---
  adminDashboardWord: { en: "Dashboard", de: "Dashboard" },
  adminSearchPlaceholder: { en: "Search orders, articles, log…", de: "Bestellungen, Artikel, Log durchsuchen…" },
  adminClearSearch: { en: "Clear search", de: "Suche löschen" },
  adminOrdersTitle: { en: "Orders", de: "Bestellungen" },
  adminLogTitle: { en: "Log", de: "Log" },
  adminArticlesTitle: { en: "Stock", de: "Bestand" },
  adminStatOrders: { en: "# Orders", de: "# Bestellungen" },
  adminStatRevenue: { en: "Paid by customer", de: "Bezahlt von Kunden" },
  adminStatReceived: { en: "Received", de: "Erhalten" },
  adminStatCostPrice: { en: "Cost price", de: "Einkaufspreis" },
  adminStatCostPricePaid: { en: "Cost price (paid items)", de: "Einkaufspreis (bezahlte Artikel)" },
  adminStatNotCollected: { en: "Not collected", de: "Nicht abgeholt" },
  adminStatTrend: { en: "Trend", de: "Verlauf" },
  adminRangeToday: { en: "Today", de: "Heute" },
  adminRangeWeek: { en: "Week", de: "Woche" },
  adminRangeMonth: { en: "Month", de: "Monat" },
  adminRangeAll: { en: "All", de: "Alle" },
  adminCustomRange: { en: "Custom range", de: "Zeitraum wählen" },
  adminDateFrom: { en: "From", de: "Von" },
  adminDateTo: { en: "To", de: "Bis" },
  adminColDateTime: { en: "Date/Time", de: "Datum/Zeit" },
  adminColClient: { en: "Client", de: "Kunde" },
  adminColItems: { en: "Items", de: "Artikel" },
  adminColReady: { en: "Ready", de: "Bereit" },
  adminColPicked: { en: "Picked up", de: "Abgeholt" },
  adminYes: { en: "Yes", de: "Ja" },
  adminNo: { en: "No", de: "Nein" },
  adminBadgeCancelled: { en: "Cancelled", de: "Storniert" },
  adminOrderDetails: { en: "Order details", de: "Bestelldetails" },
  adminOrderNumber: { en: "Order number", de: "Bestellnummer" },
  adminEmail: { en: "Email", de: "E-Mail" },
  adminPaymentStatus: { en: "Payment status", de: "Zahlungsstatus" },
  adminPricePaid: { en: "Price paid", de: "Bezahlter Preis" },
  adminMoneyReceived: { en: "Money received", de: "Erhaltener Betrag" },
  adminCustomerNote: { en: "Customer note", de: "Bemerkung Kunde" },
  adminInternalNote: { en: "Internal note", de: "Interne Notiz" },
  adminInternalNotePlaceholder: {
    en: "Add an internal note (only visible to staff)…",
    de: "Interne Notiz hinzufügen (nur für Mitarbeitende sichtbar)…",
  },
  adminSaveNote: { en: "Save note", de: "Notiz speichern" },
  adminNoteSaved: { en: "Note saved", de: "Notiz gespeichert" },
  adminItems: { en: "Items", de: "Artikel" },
  adminTotal: { en: "Total", de: "Total" },
  adminMarkReady: { en: "Ready", de: "Bereit" },
  adminMarkPickedUp: { en: "Picked up", de: "Abgeholt" },
  adminCancelOrder: { en: "Cancel", de: "Stornieren" },
  adminNoDateInfo: { en: "No information about date", de: "Keine Information zum Datum" },
  adminNotReady: { en: "Not ready", de: "Nicht bereit" },
  adminNotPickedUp: { en: "Not picked up", de: "Nicht abgeholt" },
  adminUndoReady: { en: "Undo", de: "Rückgängig" },
  adminUndoPickedUp: { en: "Undo", de: "Rückgängig" },
  adminArticleDetails: { en: "Article details", de: "Artikeldetails" },
  adminArticleNumber: { en: "Article number", de: "Artikelnummer" },
  adminPriceLabel: { en: "Price", de: "Preis" },
  adminColor: { en: "Color", de: "Farbe" },
  adminCategory: { en: "Category", de: "Kategorie" },
  adminDescription: { en: "Description", de: "Beschreibung" },
  adminStockLabel: { en: "Stock", de: "Lagerbestand" },
  adminSize: { en: "Size", de: "Grösse" },
  adminInStock: { en: "in stock", de: "auf Lager" },
  adminLowStock: { en: "Low stock", de: "Niedriger Bestand" },
  adminOutOfStock: { en: "Out of stock", de: "Ausverkauft" },
  adminNoResults: { en: "No results", de: "Keine Ergebnisse" },
  adminKindPurchase: { en: "Ordered", de: "Bestellt" },
  adminKindReady: { en: "Marked ready", de: "Bereit gemeldet" },
  adminKindPickup: { en: "Picked up", de: "Abgeholt" },
  adminKindCancel: { en: "Cancelled", de: "Storniert" },
  adminKindReadyUndo: { en: "Ready undone", de: "Bereit rückgängig" },
  adminKindPickupUndo: { en: "Pickup undone", de: "Abholung rückgängig" },
  adminAllCategories: { en: "All", de: "Alle" },
  adminLogout: { en: "Log out", de: "Abmelden" },
  adminItemsSuffix: { en: " items", de: " Art." },
  adminCancelDialogTitle: { en: "Cancel order", de: "Bestellung stornieren" },
  adminCancelReasonLabel: { en: "Reason for cancellation", de: "Grund für die Stornierung" },
  adminCancelReasonPlaceholder: {
    en: "Why is this order being cancelled?",
    de: "Weshalb wird diese Bestellung storniert?",
  },
  adminCancelConfirmQuestion: {
    en: "Are you sure you want to cancel this order and refund the money to the customer?",
    de: "Möchtest du diese Bestellung wirklich stornieren und dem Kunden das Geld zurückerstatten?",
  },
  adminConfirmCancelOrder: { en: "Confirm cancellation", de: "Stornierung bestätigen" },
  adminRefundAmountLabel: { en: "Refund amount (CHF)", de: "Rückerstattungsbetrag (CHF)" },
  adminRefundAmountHint: { en: "Amount paid:", de: "Bezahlter Betrag:" },
  adminRefundNoPayment: {
    en: "This order has no online payment to refund - it will just be cancelled.",
    de: "Diese Bestellung hat keine Online-Zahlung zum Zurückerstatten - sie wird nur storniert.",
  },
  adminLoadError: { en: "Failed to load dashboard data.", de: "Dashboard-Daten konnten nicht geladen werden." },
  adminSessionExpired: {
    en: "Your session expired. Please sign in again.",
    de: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
  },
  adminActionError: { en: "Action failed. Please try again.", de: "Aktion fehlgeschlagen. Bitte erneut versuchen." },
  adminNA: { en: "N/A", de: "k. A." },
  adminEdit: { en: "Edit", de: "Bearbeiten" },
  adminPrevImage: { en: "Previous image", de: "Vorheriges Bild" },
  adminNextImage: { en: "Next image", de: "Nächstes Bild" },
  adminGalleryItem: { en: "Item", de: "Element" },
  adminLoadingDetails: { en: "Loading more details…", de: "Weitere Details werden geladen…" },
  adminOpenArticle: { en: "Open article", de: "Artikel öffnen" },
  adminSave: { en: "Save", de: "Speichern" },
  adminSaving: { en: "Saving…", de: "Speichern…" },
  adminCancel: { en: "Cancel", de: "Abbrechen" },
  adminSaveSuccess: { en: "Article saved.", de: "Artikel gespeichert." },
  adminSaveError: { en: "Save failed. Please try again.", de: "Speichern fehlgeschlagen. Bitte erneut versuchen." },
  adminProductId: { en: "Product group", de: "Produktgruppe" },
  adminNameLabel: { en: "Name", de: "Name" },
  adminCostPrice: { en: "Cost price", de: "Einkaufspreis" },
  adminPriceAutoCalculated: {
    en: "Calculated automatically from cost price",
    de: "Wird automatisch aus dem Einkaufspreis berechnet",
  },
  adminMainCategory: { en: "Main category", de: "Rubrik" },
  adminColorCode: { en: "Color code", de: "Farbcode" },
  adminReturnCategory: { en: "Return category", de: "Rückgabe-Kategorie" },
  adminSortOrder: { en: "Sort order", de: "Reihenfolge" },
  adminJustStock: { en: "Just sell stock", de: "Nur Bestand verkaufen" },
  adminNotes: { en: "Internal notes", de: "Interne Notizen" },
  adminImages: { en: "Images", de: "Bilder" },
  adminImagesSaveNote: { en: "changes save immediately", de: "Änderungen werden sofort gespeichert" },
  adminAddImage: { en: "Add", de: "Hinzufügen" },
  adminDeleteImage: { en: "Delete image", de: "Bild löschen" },
  adminMoveImageLeft: { en: "Move earlier", de: "Nach vorne verschieben" },
  adminMoveImageRight: { en: "Move later", de: "Nach hinten verschieben" },
  adminDragToReorder: { en: "Drag to reorder", de: "Ziehen zum Sortieren" },
  adminMoveSizeUp: { en: "Move size up", de: "Grösse nach oben verschieben" },
  adminMoveSizeDown: { en: "Move size down", de: "Grösse nach unten verschieben" },
  adminEmbed3d: { en: "3D embed code", de: "3D-Einbettungscode" },
  adminAddNewOption: { en: "+ Add new…", de: "+ Neu hinzufügen…" },
  adminNewCategoryPlaceholder: { en: "Type a new value…", de: "Neuen Wert eingeben…" },
  adminColTotal: { en: "Total", de: "Total" },
  adminReturnTag: { en: "Return", de: "Retoure" },
  adminKidzbike: { en: "KidzBike Member", de: "KidzBike Mitglied" },
  adminPlacedAt: { en: "Placed", de: "Bestellt" },
  adminDeleteArticle: { en: "Delete article", de: "Artikel löschen" },
  adminDeleting: { en: "Deleting…", de: "Wird gelöscht…" },
  adminDeleteArticleConfirm: {
    en: "Delete this article and all its sizes/stock? This cannot be undone.",
    de: "Diesen Artikel und alle seine Grössen/Bestände löschen? Das kann nicht rückgängig gemacht werden.",
  },
  adminDeleteArticleSuccess: { en: "Article deleted.", de: "Artikel gelöscht." },
  adminDeleteArticleError: {
    en: "Couldn't delete this article - it's likely still referenced by existing orders.",
    de: "Artikel konnte nicht gelöscht werden - vermutlich wird er noch in bestehenden Bestellungen referenziert.",
  },

  adminPromoCodes: { en: "Promo codes", de: "Aktionscodes" },
  adminPromoCodesDesc: {
    en: "Manage the promo codes customers can enter at checkout.",
    de: "Verwalte die Aktionscodes, die Kunden beim Checkout eingeben können.",
  },
  adminNewPromoCode: { en: "New promo code", de: "Neuer Aktionscode" },
  adminPromoCodeLabel: { en: "Code", de: "Code" },
  adminPromoCodeType: { en: "Type", de: "Typ" },
  adminPromoTypeReturnCategory: { en: "One free item per return category", de: "Ein Gratisartikel pro Rückgabe-Kategorie" },
  adminPromoTypePercentage: { en: "Percentage off the order", de: "Prozentualer Rabatt auf die Bestellung" },
  adminPromoTypeFreeOrder: { en: "Entire order free", de: "Ganze Bestellung gratis" },
  adminPromoPercentageLabel: { en: "Percentage (%)", de: "Prozentsatz (%)" },
  adminPromoActive: { en: "Active", de: "Aktiv" },
  adminPromoInactive: { en: "Inactive", de: "Inaktiv" },
  adminAddPromoCode: { en: "Add promo code", de: "Aktionscode hinzufügen" },
  adminNoPromoCodes: { en: "No promo codes yet.", de: "Noch keine Aktionscodes." },
  adminDeletePromoCodeConfirm: {
    en: "Delete this promo code? This cannot be undone.",
    de: "Diesen Aktionscode löschen? Das kann nicht rückgängig gemacht werden.",
  },
  adminPromoCodeSaveError: {
    en: "Save failed. Make sure the code is unique and try again.",
    de: "Speichern fehlgeschlagen. Stelle sicher, dass der Code eindeutig ist, und versuche es erneut.",
  },
  adminReorderHint: {
    en: "Use the arrows to reorder how products appear in the shop.",
    de: "Mit den Pfeilen kannst du die Reihenfolge der Produkte im Shop ändern.",
  },
  adminReorderUnavailable: {
    en: "Reordering is only available with no search and \"All\" category selected.",
    de: "Umsortieren ist nur ohne Suche und mit ausgewählter Kategorie \"Alle\" möglich.",
  },
  adminColorsCount: { en: "colors", de: "Farben" },
  adminSortOrderHint: {
    en: "Use the arrows in the article list to change this (see \"All\" category, no search)",
    de: "Über die Pfeile in der Artikelliste änderbar (Kategorie \"Alle\", ohne Suche)",
  },
};
