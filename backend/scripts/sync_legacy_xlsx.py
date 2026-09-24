#!/usr/bin/env python3
"""
Sync PocketBase with an UPDATED "Velo Club Horgen Webshop.xlsx" export -
use this (instead of import_legacy_xlsx.py) once the initial import has
already happened and the Excel file has since picked up new orders and/or
changed stock counts.

Run this on YOUR OWN computer, not the server - it only needs network access
to your public PocketBase URL and the local xlsx file. Nothing here needs
SSH or server access.

What this script does, vs. the original one-time import:
  - Articles/stock are NOT synced anymore - that one-time catch-up (create
    new articles, update stock counts) has already been done. This script
    only reads the existing "articles" collection (article_number -> id)
    to match order_items against, it never creates, updates or reads the
    Lagerbestand sheet at all.
  - Orders: unchanged from the original import - a new Order ID creates
    a new order (+ its order_items + a "purchase" log entry). An
    order_number that already exists is left untouched (ready/picked_up
    status now lives in the dashboard, not the Excel), except that a
    missing "purchase" log entry is still backfilled if somehow absent.

Setup (once):
    pip install openpyxl requests

Usage:
    python sync_legacy_xlsx.py "C:\\path\\to\\Velo Club Horgen Webshop (4).xlsx"

You'll be prompted for your PocketBase superuser email/password - they are
only used to log in and are never stored or sent anywhere else.

Safe to re-run: orders are matched by order_number - anything already
imported is left alone (or just gets a missing purchase log backfilled)
instead of being duplicated.
"""

import re
import sys
from datetime import datetime
import openpyxl
import requests

POCKETBASE_URL = "https://api-webshop-veloclubhorgen.duckdns.org"


def to_id_str(value):
    """Excel gives us numeric IDs (article numbers, order IDs) as floats."""
    if value is None:
        return ""
    if isinstance(value, float):
        return str(int(value))
    return str(value).strip()


def header_map(ws, header_row):
    headers = [ws.cell(row=header_row, column=c).value for c in range(1, ws.max_column + 1)]
    return {h: i + 1 for i, h in enumerate(headers) if h}


# Payment gateway fee model used to derive the amount actually received per
# order. Do NOT read "Tatsächlich eingegangen" / "Summe Pro Kunde" directly -
# they turned out to be unreliable (in particular: blank whenever whoever
# filled in the sheet forgot to fill them in for a new order, which silently
# produced amount_paid/price_paid = 0 for otherwise perfectly normal paid
# orders). Instead: sum "Preis Total" across all of a client's order rows
# (0 there means a genuinely free/return-promo line, so it correctly stays
# 0), then apply the fee once per order (fees are charged per transaction,
# not per line item). Same formula as import_legacy_xlsx.mjs's
# computeActualAmount / import_legacy_xlsx.py's compute_actual_amount - keep
# all three in sync if this ever changes.
FEE_RATE = 0.029
FEE_FIXED = 0.30


def compute_actual_amount(total_price):
    raw = total_price * (1 - FEE_RATE) - FEE_FIXED
    # clamp at 0 - a free (return-promo) order has no real transaction, so it
    # can't have "received" a negative amount.
    return max(0.0, round(raw, 2))


def line_charged_amount(ws, row, col):
    """The charged amount for one order row - "Preis Total", forced to 0 if
    isReturn is checked (a return-promo item was given away free, even if
    the sheet's "Preis Total" cell for that row wasn't actually updated to
    0). "Preis pro Artikel" (unit price) never factors into this - it's
    stored on order_items.unit_price purely as reference info."""
    if ws.cell(row=row, column=col["isReturn"]).value:
        return 0.0
    return float(ws.cell(row=row, column=col["Preis Total"]).value or 0)


# Only orders placed after this date get created/corrected by a run of this
# script - per request, to scope a fix to recently-affected orders rather
# than touching the entire historical dataset. Bump/remove this for a
# future full re-sync. Naive (no tzinfo) - openpyxl gives back naive
# datetimes for Excel date cells, and comparing naive-to-aware raises.
ORDER_CUTOFF = datetime(2026, 7, 12)


class PocketBase:
    def __init__(self, base_url):
        self.base_url = base_url.rstrip("/")
        self.token = None

    def login(self):
        # Sanity-check the server is even reachable before asking for
        # credentials, so a network problem fails fast with a clear message
        # instead of hanging silently later.
        print(f"Checking {self.base_url} is reachable...")
        sys.stdout.flush()
        try:
            r = requests.get(f"{self.base_url}/api/health", timeout=10)
            r.raise_for_status()
            print("Server is reachable.")
        except requests.exceptions.RequestException as err:
            print(f"\nCould NOT reach {self.base_url}: {err}")
            print("Check that PocketBase is running and this URL is correct/public")
            print("before continuing. Aborting.")
            sys.exit(1)

        email = input(
            "PocketBase superuser email (leave blank to skip login, e.g. if you "
            "temporarily opened up the collection API rules): "
        ).strip()
        if not email:
            print("Skipping login - requests will be sent unauthenticated.")
            self.token = None
            return

        # Visible prompt instead of getpass.getpass() on purpose - getpass
        # hangs indefinitely in Git Bash / MSYS2 terminals on Windows. This
        # is a local one-off admin script, so visible entry is acceptable.
        # Explicit flush before input() - Git Bash's MinGW pty can otherwise
        # buffer this prompt and never show it, making the script look
        # frozen even though it's just waiting for you to type blind.
        print("PocketBase superuser password (visible while typing): ", end="", flush=True)
        password = input().strip()
        print("Logging in...")
        sys.stdout.flush()
        try:
            r = requests.post(
                f"{self.base_url}/api/collections/_superusers/auth-with-password",
                json={"identity": email, "password": password},
                timeout=15,
            )
        except requests.exceptions.RequestException as err:
            print(f"\nLogin request failed: {err}")
            sys.exit(1)
        if not r.ok:
            print(f"\nLogin failed ({r.status_code}): {r.text}")
            sys.exit(1)
        self.token = r.json()["token"]
        print("Logged in.")

    def _headers(self):
        return {"Authorization": self.token} if self.token else {}

    def find_one(self, collection, filter_str):
        r = requests.get(
            f"{self.base_url}/api/collections/{collection}/records",
            params={"filter": filter_str, "perPage": 1},
            headers=self._headers(),
            timeout=15,
        )
        r.raise_for_status()
        items = r.json().get("items", [])
        return items[0] if items else None

    def create(self, collection, data):
        r = requests.post(
            f"{self.base_url}/api/collections/{collection}/records",
            json=data,
            headers=self._headers(),
            timeout=15,
        )
        if not r.ok:
            print(f"  ERROR creating {collection}: {r.status_code} {r.text}")
            print(f"  payload was: {data}")
            r.raise_for_status()
        return r.json()

    def update(self, collection, record_id, data):
        r = requests.patch(
            f"{self.base_url}/api/collections/{collection}/records/{record_id}",
            json=data,
            headers=self._headers(),
            timeout=15,
        )
        if not r.ok:
            print(f"  ERROR updating {collection}/{record_id}: {r.status_code} {r.text}")
            print(f"  payload was: {data}")
            r.raise_for_status()
        return r.json()

    def list_all(self, collection, fields=None):
        """Fetches every record in a collection (paginated, 500/page)."""
        items = []
        page = 1
        while True:
            params = {"perPage": 500, "page": page}
            if fields:
                params["fields"] = fields
            r = requests.get(
                f"{self.base_url}/api/collections/{collection}/records",
                params=params,
                headers=self._headers(),
                timeout=15,
            )
            r.raise_for_status()
            body = r.json()
            items.extend(body.get("items", []))
            if page >= body.get("totalPages", 1):
                break
            page += 1
        return items


def fetch_article_id_map(pb):
    """Looks up article_number -> record id for every existing article, so
    sync_orders() can attach order_items to the right article. Read-only -
    articles/stock are no longer synced from the Excel by this script (that
    one-time catch-up is already done), so the Lagerbestand sheet is never
    even opened here."""
    articles = pb.list_all("articles", fields="id,article_number")
    return {a["article_number"]: a["id"] for a in articles}


def sync_orders(wb, pb, article_id_by_number):
    ws = wb["Bestellungen"]
    col = header_map(ws, 1)

    orders = {}
    for r in range(2, ws.max_row + 1):
        oid = to_id_str(ws.cell(row=r, column=col["Order ID"]).value)
        if not oid:
            continue
        orders.setdefault(oid, []).append(r)

    total = len(orders)
    print(f"  {total} distinct orders in the sheet - checking each against the database...")

    n_orders = 0
    n_items = 0
    n_items_corrected = 0
    n_logs = 0

    for i, (oid, rows) in enumerate(orders.items(), start=1):
        # Existing (already-imported, unchanged) orders print nothing below,
        # so without this the script can go quiet for a long stretch while
        # it works through a big backlog of already-known orders - print a
        # heartbeat every 50 so it's clear it's still running, not frozen.
        if i % 50 == 0 or i == total:
            print(f"  ... checked {i}/{total}")
        first = rows[0]
        name_full = str(ws.cell(row=first, column=col["Name"]).value or "").strip()
        parts = re.split(r"\s+", name_full, maxsplit=1)
        buyer_name = parts[0] if parts else ""
        buyer_lastname = parts[1] if len(parts) > 1 else ""

        timestamp = ws.cell(row=first, column=col["Timestamp"]).value
        placed_at = timestamp.isoformat() if hasattr(timestamp, "isoformat") else ""

        # Scope this run to recently-affected orders only (see ORDER_CUTOFF).
        if not isinstance(timestamp, datetime) or timestamp <= ORDER_CUTOFF:
            continue

        # Don't trust "Tatsächlich eingegangen" / "Summe Pro Kunde" - see the
        # module docstring above compute_actual_amount. Never let "Preis pro
        # Artikel" (unit price) influence this either - only line_charged_
        # amount() (normally "Preis Total", forced to 0 for a return-promo
        # row) does.
        total_price = sum(line_charged_amount(ws, r, col) for r in rows)
        actual_amount = compute_actual_amount(total_price)

        existing_order = pb.find_one("orders", f'order_number = "{oid}"')

        if existing_order:
            # Existing order: ready/picked_up/cancelled status is left
            # untouched on purpose - that's managed in the admin dashboard
            # now, not the Excel. amount_paid IS still corrected below
            # though, in case an earlier run stored a wrong value (e.g. the
            # "Summe Pro Kunde was blank" bug this function's docstring
            # warns about).
            order_rec = existing_order
            create_items = False
            existing_amount = existing_order.get("amount_paid") or 0
            if abs(existing_amount - actual_amount) > 0.001:
                print(f"    orders: correcting amount_paid for {oid}: {existing_amount} -> {actual_amount}")
                pb.update("orders", order_rec["id"], {"amount_paid": actual_amount})
        else:
            order_data = {
                "order_number": oid,
                "buyer_name": buyer_name or "unknown",
                "buyer_lastname": buyer_lastname,
                "buyer_email": ws.cell(row=first, column=col["Email"]).value or "",
                "kidzbike": bool(ws.cell(row=first, column=col["KidzBike"]).value),
                "comments": ws.cell(row=first, column=col["Comments"]).value or "",
                "payment_provider": "legacy",
                "payment_status": "confirmed",
                "amount_paid": actual_amount,
                "currency": ws.cell(row=first, column=col["Währung"]).value or "CHF",
                "placed_at": placed_at,
                # tri-state text field: "" = unknown, same convention as the
                # original import.
                "ready": "",
                "picked_up": "",
            }
            order_rec = pb.create("orders", order_data)
            n_orders += 1
            create_items = True
            print(f"  orders: created {oid} ({buyer_name} {buyer_lastname}), amount_paid={actual_amount}")

        need_log = True
        if not create_items:
            already_logged = pb.find_one(
                "logs", f'order = "{order_rec["id"]}" && kind = "purchase"'
            )
            need_log = not already_logged

        # NOTE: no early "continue" here even when an existing order needs
        # neither new items nor a log - its rows still get walked below so
        # order_items.price_paid can be corrected (see the else branch).

        note_parts = []
        for r in rows:
            article_number = to_id_str(ws.cell(row=r, column=col["Artikelnummer"]).value)
            article_id = article_id_by_number.get(article_number)
            if not article_id:
                print(f"    WARNING: order {oid} references unknown article {article_number}, skipping line")
                continue

            size = ws.cell(row=r, column=col["Grösse"]).value or ""
            qty = ws.cell(row=r, column=col["Anzahl"]).value or 0
            # The charged amount for this line - "Preis Total", forced to 0
            # if isReturn is set. "Preis pro Artikel" (unit price) never
            # factors in here - the fee deduction is applied once at the
            # order level (above), not per line.
            preis_total = line_charged_amount(ws, r, col)

            if create_items:
                item_data = {
                    "order": order_rec["id"],
                    "article": article_id,
                    "size": size,
                    "color": ws.cell(row=r, column=col["Farbe"]).value or "",
                    "quantity": qty,
                    "unit_price": ws.cell(row=r, column=col["Preis pro Artikel"]).value or 0,
                    "price_paid": preis_total,
                    "is_return": bool(ws.cell(row=r, column=col["isReturn"]).value),
                    "return_category": "",
                }
                pb.create("order_items", item_data)
                n_items += 1
            else:
                # Existing order - correct this line's price_paid if an
                # earlier run stored the wrong value (the "Tatsächlich
                # eingegangen was blank" bug).
                existing_item = pb.find_one(
                    "order_items",
                    f'order = "{order_rec["id"]}" && article = "{article_id}" && size = "{size}"',
                )
                if existing_item:
                    existing_price = existing_item.get("price_paid") or 0
                    if abs(existing_price - preis_total) > 0.001:
                        pb.update("order_items", existing_item["id"], {"price_paid": preis_total})
                        n_items_corrected += 1
                        print(
                            f"    order_items: corrected price_paid for {oid} {article_number} "
                            f"({size}): {existing_price} -> {preis_total}"
                        )

            if need_log:
                note_parts.append(f"{article_number} x{qty} ({size})")

        if need_log:
            action = "creating" if create_items else "backfilling missing"
            print(f"    logs: {action} purchase log for {oid}")
            pb.create("logs", {
                "order": order_rec["id"],
                "kind": "purchase",
                "note": ", ".join(note_parts),
                "placed_at": placed_at,
            })
            n_logs += 1

    print(
        f"orders created: {n_orders}, order_items created: {n_items}, "
        f"order_items price_paid corrected: {n_items_corrected}, logs created: {n_logs}"
    )


def main():
    if len(sys.argv) != 2:
        print(f"Usage: python {sys.argv[0]} <path-to-xlsx>")
        sys.exit(1)

    wb = openpyxl.load_workbook(sys.argv[1], data_only=True)

    pb = PocketBase(POCKETBASE_URL)
    pb.login()

    print("\nLooking up existing articles...")
    article_id_by_number = fetch_article_id_map(pb)
    print(f"  {len(article_id_by_number)} articles found.")

    print("\nSyncing orders...")
    sync_orders(wb, pb, article_id_by_number)

    print("\nDone.")


if __name__ == "__main__":
    main()
