import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useTranslation } from "@/hooks/useTranslation";
import { useToast } from "@/hooks/use-toast";
import {
  listOrders,
  listOrderItems,
  listLogs,
  updateOrder,
  cancelOrder,
  parseTriState,
  computeMoneyReceived,
  AuthExpiredError,
  articleFileUrl,
  listAllArticles,
  setArticleSortOrders,
} from "@/lib/adminApi";
import { fetchStock } from "@/lib/stockApi";
import { inRange, RangeMode } from "@/lib/adminFormat";
import { assetUrl } from "@/lib/assetUrl";
import { cn } from "@/lib/utils";
import { EnrichedOrder, EnrichedArticle, EnrichedLog } from "@/types/admin";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { OrdersPanel } from "@/components/admin/OrdersPanel";
import { LogPanel, LogKindFilter } from "@/components/admin/LogPanel";
import { ArticlesPanel } from "@/components/admin/ArticlesPanel";
import { OrderModal } from "@/components/admin/OrderModal";
import { CancelOrderDialog } from "@/components/admin/CancelOrderDialog";
import { ArticleModal } from "@/components/admin/ArticleModal";
import { PromoCodesModal } from "@/components/admin/PromoCodesModal";
import { MobileTabBar, MobileTab } from "@/components/admin/MobileTabBar";

const PLACEHOLDER_IMG = assetUrl("/placeholder.svg");

const AdminDashboard = () => {
  const { auth } = useAdminAuth();
  const token = auth!.token;
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [rangeMode, setRangeMode] = useState<RangeMode>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [articleCategory, setArticleCategory] = useState("all");
  const [logKind, setLogKind] = useState<LogKindFilter>("all");
  const [mobileTab, setMobileTab] = useState<MobileTab>("orders");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  const [cancelRefundAmount, setCancelRefundAmount] = useState("");
  const [promoCodesOpen, setPromoCodesOpen] = useState(false);

  const ordersQuery = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => listOrders(token),
    refetchInterval: 30000,
  });
  const orderItemsQuery = useQuery({
    queryKey: ["admin-order-items"],
    queryFn: () => listOrderItems(token),
    refetchInterval: 30000,
  });
  const logsQuery = useQuery({
    queryKey: ["admin-logs"],
    queryFn: () => listLogs(token),
    refetchInterval: 30000,
  });
  const stockQuery = useQuery({
    queryKey: ["admin-stock"],
    queryFn: () => fetchStock(),
    refetchInterval: 30000,
  });
  // Raw articles (real record ids + sort_order), used only by the product
  // reorder controls below - EnrichedArticle (built from the public
  // /api/stock shape) doesn't carry the actual PocketBase record id needed
  // to PATCH sort_order.
  const rawArticlesQuery = useQuery({
    queryKey: ["admin-articles-raw"],
    queryFn: () => listAllArticles(token),
    refetchInterval: 30000,
  });

  // Exclude AuthExpiredError from the generic banner - that case clears the
  // session and redirects to /admin/login almost immediately (see
  // AdminAuthContext's AUTH_EXPIRED_EVENT listener), so showing a "failed to
  // load" message here for a split second would just be confusing.
  const isRealLoadError = (q: { isError: boolean; error: unknown }) =>
    q.isError && !(q.error instanceof AuthExpiredError);
  const loadError =
    isRealLoadError(ordersQuery) ||
    isRealLoadError(orderItemsQuery) ||
    isRealLoadError(logsQuery) ||
    isRealLoadError(stockQuery);

  const orders = ordersQuery.data || [];
  const orderItems = orderItemsQuery.data || [];
  const logs = logsQuery.data || [];
  const stock = stockQuery.data || [];

  const enrichedOrders: EnrichedOrder[] = useMemo(() => {
    const itemsByOrder: Record<string, typeof orderItems> = {};
    for (const it of orderItems) {
      if (!itemsByOrder[it.order]) itemsByOrder[it.order] = [];
      itemsByOrder[it.order].push(it);
    }

    // orders.ready/picked_up only say *that* something happened, not
    // *when* or *by whom* - pull that from the matching log entry (the
    // most recent one, in case an order somehow got marked twice). Use the
    // log's own placed_at, not its created autodate - they're normally the
    // same instant, but placed_at is the field that's actually documented
    // to hold "when this really happened".
    //
    // "ready"/"pickup" log entries are never deleted (undoing adds a
    // "ready_undo"/"pickup_undo" entry instead of erasing the original -
    // see 1783905000_logs_undo_kinds.js), so the most recent "ready" log
    // for an order can be stale if it was since undone. That's fine here:
    // the gate below (only using these values when the order is CURRENTLY
    // ready/picked up) is what actually prevents a stale timestamp from
    // showing, not this lookup.
    const eventTimesByOrder: Record<
      string,
      {
        readyAt?: string;
        readyBy?: string;
        pickedAt?: string;
        pickedBy?: string;
        cancelledAt?: string;
        cancelledBy?: string;
      }
    > = {};
    for (const l of logs) {
      if (l.kind !== "ready" && l.kind !== "pickup" && l.kind !== "cancel") continue;
      const at = l.placed_at || l.created;
      const cur = eventTimesByOrder[l.order] || {};
      if (l.kind === "ready" && (!cur.readyAt || at > cur.readyAt)) {
        cur.readyAt = at;
        cur.readyBy = l.admin_name || undefined;
      }
      if (l.kind === "pickup" && (!cur.pickedAt || at > cur.pickedAt)) {
        cur.pickedAt = at;
        cur.pickedBy = l.admin_name || undefined;
      }
      // cancel is one-shot (an order can only ever be cancelled once - see
      // admin.pb.js's cancel route, which rejects re-cancelling), so unlike
      // ready/pickup there's no "most recent" ambiguity to resolve here.
      if (l.kind === "cancel") {
        cur.cancelledAt = at;
        cur.cancelledBy = l.admin_name || undefined;
      }
      eventTimesByOrder[l.order] = cur;
    }

    return orders.map((o) => {
      const items = (itemsByOrder[o.id] || []).map((it) => ({
        id: it.id,
        articleNumber: it.expand?.article?.article_number || "",
        name: it.expand?.article?.name || it.article,
        color: it.color || it.expand?.article?.color_name || "",
        size: it.size,
        quantity: it.quantity,
        unitPrice: it.unit_price,
        pricePaid: it.price_paid,
        costPrice: (it.expand?.article?.cost_price || 0) * it.quantity,
        image:
          it.expand?.article?.id && it.expand.article.images?.[0]
            ? articleFileUrl(it.expand.article.id, it.expand.article.images[0])
            : PLACEHOLDER_IMG,
        isReturn: !!it.is_return,
      }));
      const itemCount = items.reduce((s, it) => s + it.quantity, 0);
      const costPriceTotal = items.reduce((s, it) => s + it.costPrice, 0);
      const costPricePaidTotal = items.reduce((s, it) => s + (it.isReturn ? 0 : it.costPrice), 0);
      // Legacy-imported orders (payment_provider === "legacy") don't follow
      // the same amount_paid convention as real Zahls/free orders - see the
      // pricePaid/moneyReceived comments on EnrichedOrder (types/admin.ts)
      // for why. Gross price for those has to come from the items, not
      // amount_paid; amount_paid there is already the net received amount.
      const isLegacyOrder = o.payment_provider === "legacy";
      const pricePaid = isLegacyOrder ? items.reduce((s, it) => s + it.pricePaid, 0) : o.amount_paid || 0;
      const moneyReceived = isLegacyOrder ? o.amount_paid || 0 : computeMoneyReceived(o);
      // Only surface the derived ready/picked-up timestamp while the order
      // is CURRENTLY in that state - the underlying log entries stick
      // around after an undo (see the comment above eventTimesByOrder), so
      // without this gate an undone order would keep showing "marked ready
      // at ..." even though it no longer is.
      const isReady = parseTriState(o.ready) === true;
      const isPicked = parseTriState(o.picked_up) === true;
      return {
        ...o,
        fullName: `${o.buyer_name} ${o.buyer_lastname}`.trim(),
        itemCount,
        items,
        costPriceTotal,
        costPricePaidTotal,
        pricePaid,
        moneyReceived,
        readyAt: isReady ? eventTimesByOrder[o.id]?.readyAt : undefined,
        readyBy: isReady ? eventTimesByOrder[o.id]?.readyBy : undefined,
        pickedAt: isPicked ? eventTimesByOrder[o.id]?.pickedAt : undefined,
        pickedBy: isPicked ? eventTimesByOrder[o.id]?.pickedBy : undefined,
        // No gating needed here (unlike ready/picked above) - cancellation
        // can't be undone, so there's no "stale after undo" case to guard
        // against.
        cancelledAt: eventTimesByOrder[o.id]?.cancelledAt,
        cancelledBy: eventTimesByOrder[o.id]?.cancelledBy,
      };
    });
  }, [orders, orderItems, logs]);

  const ordersById = useMemo(() => {
    const map: Record<string, EnrichedOrder> = {};
    for (const o of enrichedOrders) map[o.id] = o;
    return map;
  }, [enrichedOrders]);

  const now = new Date();

  const searchLower = search.trim().toLowerCase();
  const matches = (hay: string) => !searchLower || hay.toLowerCase().includes(searchLower);

  const ordersInRange = useMemo(
    () =>
      enrichedOrders.filter((o) =>
        inRange(o.placed_at || o.created, rangeMode, now, customFrom, customTo),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enrichedOrders, rangeMode, customFrom, customTo],
  );

  const filteredOrders = useMemo(
    () =>
      ordersInRange.filter(
        (o) =>
          matches(o.order_number) ||
          matches(o.fullName) ||
          o.items.some((it) => matches(it.name) || matches(it.articleNumber)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ordersInRange, searchLower],
  );

  const stats = useMemo(() => {
    const notCancelled = filteredOrders.filter((o) => !o.cancelled);
    const revenue = notCancelled.reduce((s, o) => s + (o.pricePaid || 0), 0);
    const received = notCancelled.reduce((s, o) => s + (o.moneyReceived || 0), 0);
    const costPrice = notCancelled.reduce((s, o) => s + (o.costPriceTotal || 0), 0);
    const costPricePaid = notCancelled.reduce((s, o) => s + (o.costPricePaidTotal || 0), 0);
    const notCollected = filteredOrders.filter((o) => !o.cancelled && parseTriState(o.picked_up) === false).length;
    return { count: filteredOrders.length, revenue, received, costPrice, costPricePaid, notCollected };
  }, [filteredOrders]);

  const enrichedLogs: EnrichedLog[] = useMemo(() => {
    const real = logs.map((l) => {
      const order = ordersById[l.order];
      return {
        ...l,
        orderNumber: order?.order_number || "",
        fullName: order?.fullName || "",
        // Use the log's OWN timestamp, not the order's placed_at - for a
        // "ready"/"pickup"/"cancel" entry those can be days apart (the
        // order's placed_at never changes, but the log records exactly
        // when that particular action happened). For "purchase" logs the
        // backend already sets placed_at to match the order's placed_at,
        // so this is equivalent there.
        placedAt: l.placed_at || l.created || "",
      };
    });

    // Legacy orders were marked ready/picked-up directly in the database
    // (or came in via the old Excel import) before this app tracked who/
    // when - there's no real log record for those at all. Rather than
    // having them silently missing from the activity feed, add a synthetic
    // entry with an empty placedAt (LogPanel shows "no date info" for
    // those) so staff can still see it happened.
    const synthetic: EnrichedLog[] = [];
    for (const o of enrichedOrders) {
      if (parseTriState(o.ready) === true && !o.readyAt) {
        synthetic.push({
          id: `legacy-ready-${o.id}`,
          order: o.id,
          kind: "ready",
          note: "",
          created: "",
          placed_at: "",
          orderNumber: o.order_number,
          fullName: o.fullName,
          placedAt: "",
        });
      }
      if (parseTriState(o.picked_up) === true && !o.pickedAt) {
        synthetic.push({
          id: `legacy-pickup-${o.id}`,
          order: o.id,
          kind: "pickup",
          note: "",
          created: "",
          placed_at: "",
          orderNumber: o.order_number,
          fullName: o.fullName,
          placedAt: "",
        });
      }
    }

    return [...real, ...synthetic];
  }, [logs, ordersById, enrichedOrders]);

  const filteredLogs = useMemo(
    () =>
      enrichedLogs.filter(
        (l) =>
          (logKind === "all" || l.kind === logKind) &&
          (matches(l.orderNumber) || matches(l.fullName) || matches(l.note || "")),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enrichedLogs, searchLower, logKind],
  );

  const enrichedArticles: EnrichedArticle[] = useMemo(() => {
    const list: EnrichedArticle[] = [];
    for (const product of stock) {
      for (const color of product.colors) {
        const galleryUrls = (color.images || []).map((u) => assetUrl(u)).filter(Boolean);
        list.push({
          id: color.id,
          articleNumber: color.id,
          productId: product.id,
          name: product.name,
          price: product.price,
          image: galleryUrls[0] || assetUrl(product.image) || PLACEHOLDER_IMG,
          images: galleryUrls,
          image3d: color.image3d || product.image3d,
          colorName: color.name,
          colorCode: color.code,
          category: product.category,
          mainCategory: product.mainCategory,
          description: product.description,
          sizes: color.sizes.map((s) => ({ name: s.name, stock: s.stock })),
        });
      }
    }
    return list;
  }, [stock]);

  const articleCategories = useMemo(
    () => Array.from(new Set(enrichedArticles.map((a) => a.category).filter(Boolean))),
    [enrichedArticles],
  );

  // Live option lists for the article edit form's category dropdowns
  // (CategorySelect) - always derived from what's actually in use right
  // now, so newly-typed values show up once saved, and options that no
  // article uses anymore quietly disappear. No separate list is stored.
  const mainCategoryOptions = useMemo(
    () => Array.from(new Set(enrichedArticles.map((a) => a.mainCategory).filter(Boolean))).sort(),
    [enrichedArticles],
  );
  const returnCategoryOptions = useMemo(
    () => Array.from(new Set(stock.map((p) => p.isReturn).filter((v): v is string => !!v))).sort(),
    [stock],
  );

  const filteredArticles = useMemo(
    () =>
      enrichedArticles.filter((a) => {
        const matchesCategory = articleCategory === "all" || a.category === articleCategory;
        return (
          matchesCategory &&
          (matches(a.name) || matches(a.colorName) || matches(a.articleNumber))
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enrichedArticles, articleCategory, searchLower],
  );

  // Product reordering (see the big comment on ArticlesPanel's
  // "reorderMode" prop) is only offered on the complete, unfiltered
  // article list - sort_order is a single global ranking across every
  // product, so reordering within a filtered/searched subset would put
  // products back in the exact "duplicate/unclear number" mess this
  // feature exists to fix.
  const reorderMode = articleCategory === "all" && searchLower === "";

  // Current product display order, derived from `stock` (which /api/stock
  // already returns pre-sorted by sort_order) rather than recomputed here -
  // dedupe preserves that order since a product's color variants are
  // always consecutive in enrichedArticles.
  const productOrderIds = useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const a of enrichedArticles) {
      if (seen.has(a.productId)) continue;
      seen.add(a.productId);
      ids.push(a.productId);
    }
    return ids;
  }, [enrichedArticles]);

  // Every raw article record (one per color variant), grouped by the
  // product they belong to - needed so a product move can PATCH sort_order
  // onto ALL of that product's color variants, not just one.
  const articleIdsByProduct = useMemo(() => {
    const map: Record<string, Array<{ id: string; sort_order: number }>> = {};
    for (const a of rawArticlesQuery.data || []) {
      if (!map[a.product_id]) map[a.product_id] = [];
      map[a.product_id].push({ id: a.id, sort_order: a.sort_order });
    }
    return map;
  }, [rawArticlesQuery.data]);

  const [movingProductId, setMovingProductId] = useState<string | null>(null);

  const moveProductMutation = useMutation({
    mutationFn: async (nextOrder: string[]) => {
      // Renumber the WHOLE list to a clean 0..N-1 sequence and only write
      // the records whose sort_order actually changed - this is what
      // self-heals any pre-existing duplicate/gap values instead of just
      // working around them (see setArticleSortOrders's comment).
      const updates: Array<{ id: string; sort_order: number }> = [];
      nextOrder.forEach((pid, idx) => {
        for (const item of articleIdsByProduct[pid] || []) {
          if (item.sort_order !== idx) updates.push({ id: item.id, sort_order: idx });
        }
      });
      await setArticleSortOrders(token, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-stock"] });
      queryClient.invalidateQueries({ queryKey: ["admin-articles-raw"] });
    },
    onError: () => toast({ variant: "destructive", description: t("adminActionError") }),
    onSettled: () => setMovingProductId(null),
  });

  const handleMoveProduct = (productId: string, direction: -1 | 1) => {
    if (moveProductMutation.isPending) return;
    const idx = productOrderIds.indexOf(productId);
    const targetIdx = idx + direction;
    if (idx < 0 || targetIdx < 0 || targetIdx >= productOrderIds.length) return;
    const next = [...productOrderIds];
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    setMovingProductId(productId);
    moveProductMutation.mutate(next);
  };

  const selectedOrder = selectedOrderId ? ordersById[selectedOrderId] || null : null;
  const selectedArticle = selectedArticleId
    ? enrichedArticles.find((a) => a.id === selectedArticleId) || null
    : null;

  const orderMutation = useMutation({
    mutationFn: (vars: { id: string; patch: Parameters<typeof updateOrder>[2] }) =>
      updateOrder(token, vars.id, vars.patch),
    onMutate: (vars) => setBusyOrderId(vars.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
    },
    onError: () => {
      toast({ variant: "destructive", description: t("adminActionError") });
    },
    // Ready/picked-up stay open after settling - staff often want to mark
    // one and keep looking at the same order (e.g. to also add a note, or
    // because they mis-clicked and need the undo button). Cancellation no
    // longer goes through this mutation at all (see cancelMutation below),
    // which is the one that actually closes the modal on success.
    onSettled: () => setBusyOrderId(null),
  });

  const handleMarkReady = () => {
    if (!selectedOrder) return;
    orderMutation.mutate({ id: selectedOrder.id, patch: { ready: true } });
  };

  const handleMarkPicked = () => {
    if (!selectedOrder) return;
    orderMutation.mutate({ id: selectedOrder.id, patch: { picked_up: true } });
  };

  // Opens the confirmation dialog instead of cancelling right away - actual
  // cancellation (+ refund via Zahls) happens in cancelMutation below, via
  // its own dedicated backend route, not the plain orderMutation PATCH.
  const handleCancel = () => {
    if (!selectedOrder) return;
    setCancelNote(selectedOrder.cancelled_note || "");
    setCancelRefundAmount((selectedOrder.amount_paid || 0).toFixed(2));
    setCancelDialogOpen(true);
  };

  const handleCloseCancelDialog = () => {
    setCancelDialogOpen(false);
    setCancelNote("");
    setCancelRefundAmount("");
  };

  // Separate from orderMutation/undoMutation above - a cancel failure (most
  // likely the Zahls refund itself failing) needs its own, more specific
  // error message than the generic adminActionError toast the other
  // mutations show, so staff know the order was NOT cancelled and nothing
  // was refunded rather than just "something went wrong".
  const cancelMutation = useMutation({
    mutationFn: (vars: { id: string; note: string; refundAmount?: number }) =>
      cancelOrder(token, vars.id, { note: vars.note, refundAmount: vars.refundAmount }),
    onMutate: (vars) => setBusyOrderId(vars.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
      setCancelDialogOpen(false);
      setCancelNote("");
      setCancelRefundAmount("");
      setSelectedOrderId(null);
    },
    onError: (err: unknown) => {
      toast({
        variant: "destructive",
        description: err instanceof Error && err.message ? err.message : t("adminActionError"),
      });
    },
    onSettled: () => setBusyOrderId(null),
  });

  const handleConfirmCancel = () => {
    if (!selectedOrder) return;
    const amount = Number(cancelRefundAmount);
    cancelMutation.mutate({
      id: selectedOrder.id,
      note: cancelNote,
      refundAmount: selectedOrder.payment_provider === "zahls" && isFinite(amount) ? amount : undefined,
    });
  };

  // Separate mutation from orderMutation/cancelMutation above - saving a
  // note shouldn't kick the admin out of the modal they're still looking at.
  const noteMutation = useMutation({
    mutationFn: (vars: { id: string; note: string }) => updateOrder(token, vars.id, { internal_note: vars.note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ description: t("adminNoteSaved") });
    },
    onError: () => {
      toast({ variant: "destructive", description: t("adminActionError") });
    },
  });

  const handleSaveNote = (note: string) => {
    if (!selectedOrder) return;
    noteMutation.mutate({ id: selectedOrder.id, note });
  };

  // Undo for "mark ready" / "mark picked up": just flips the bool back to
  // false. The backend's onRecordUpdateRequest hook (veloclub.pb.js) does
  // the rest when it sees that transition - writes a "ready_undo"/
  // "pickup_undo" log entry (kept forever, unlike the old behavior of
  // deleting the original "ready"/"pickup" entry - see
  // 1783905000_logs_undo_kinds.js) and emails the customer a correction,
  // the same way marking ready/picked up already triggers its own email.
  // Doesn't close the modal - same reasoning as noteMutation above, this is
  // a correction, not a one-shot workflow action like the ready/picked/
  // cancel buttons.
  const undoMutation = useMutation({
    mutationFn: (vars: { orderId: string; field: "ready" | "picked_up" }) =>
      updateOrder(token, vars.orderId, { [vars.field]: false }),
    onMutate: (vars) => setBusyOrderId(vars.orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
    },
    onError: () => {
      toast({ variant: "destructive", description: t("adminActionError") });
    },
    onSettled: () => setBusyOrderId(null),
  });

  const handleUndoReady = () => {
    if (!selectedOrder) return;
    undoMutation.mutate({ orderId: selectedOrder.id, field: "ready" });
  };

  const handleUndoPicked = () => {
    if (!selectedOrder) return;
    undoMutation.mutate({ orderId: selectedOrder.id, field: "picked_up" });
  };

  // Clicking an ordered item in the order modal drills down into that
  // article's own modal - closes the order modal and opens the article one
  // (EnrichedArticle.id is the article_number/sku, same value stored on
  // each order item, see EnrichedOrderItem.articleNumber).
  const handleOpenArticleFromOrder = (articleNumber: string) => {
    setSelectedOrderId(null);
    setSelectedArticleId(articleNumber);
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[hsl(0_0%_98%)] text-[hsl(220_13%_18%)]">
      <div className="shrink-0">
        <AdminHeader search={search} onSearchChange={setSearch} onOpenPromoCodes={() => setPromoCodesOpen(true)} />
      </div>

      {loadError && (
        <div className="shrink-0 max-w-[1560px] w-full mx-auto px-4 sm:px-8 pt-4">
          <div className="bg-[hsl(0_74%_96%)] text-[hsl(0_74%_42%)] text-sm rounded-lg px-4 py-3">
            {t("adminLoadError")}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 max-w-[1560px] w-full mx-auto px-3 sm:px-8 py-4 sm:py-6 grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] xl:grid-rows-2 gap-5 overflow-hidden">
        <div
          className={cn(
            "min-h-0 h-full overflow-hidden xl:row-span-2",
            mobileTab === "orders" ? "block" : "hidden",
            "xl:block",
          )}
        >
          <OrdersPanel
            orders={filteredOrders}
            stats={stats}
            rangeMode={rangeMode}
            onRangeModeChange={(mode) => {
              setRangeMode(mode);
              setCustomFrom("");
              setCustomTo("");
            }}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFrom={(v) => {
              setCustomFrom(v);
              setRangeMode("custom");
            }}
            onCustomTo={(v) => {
              setCustomTo(v);
              setRangeMode("custom");
            }}
            onSelectOrder={setSelectedOrderId}
          />
        </div>

        <div
          className={cn("min-h-0 h-full overflow-hidden", mobileTab === "log" ? "block" : "hidden", "xl:block")}
        >
          <LogPanel
            logs={filteredLogs}
            onSelectOrder={setSelectedOrderId}
            activeKind={logKind}
            onKindChange={setLogKind}
          />
        </div>

        <div
          className={cn("min-h-0 h-full overflow-hidden", mobileTab === "stock" ? "block" : "hidden", "xl:block")}
        >
          <ArticlesPanel
            articles={filteredArticles}
            categories={articleCategories}
            activeCategory={articleCategory}
            onCategoryChange={setArticleCategory}
            onSelectArticle={setSelectedArticleId}
            reorderMode={reorderMode}
            onMoveProduct={handleMoveProduct}
            movingProductId={movingProductId}
          />
        </div>
      </div>

      <MobileTabBar active={mobileTab} onChange={setMobileTab} />

      <OrderModal
        order={selectedOrder}
        onClose={() => setSelectedOrderId(null)}
        onMarkReady={handleMarkReady}
        onMarkPicked={handleMarkPicked}
        onCancel={handleCancel}
        onOpenArticle={handleOpenArticleFromOrder}
        onSaveNote={handleSaveNote}
        savingNote={noteMutation.isPending}
        onUndoReady={handleUndoReady}
        onUndoPicked={handleUndoPicked}
        undoingReady={undoMutation.isPending && undoMutation.variables?.field === "ready"}
        undoingPicked={undoMutation.isPending && undoMutation.variables?.field === "picked_up"}
        busy={
          (orderMutation.isPending || undoMutation.isPending || cancelMutation.isPending) &&
          busyOrderId === selectedOrder?.id
        }
      />
      <CancelOrderDialog
        order={cancelDialogOpen ? selectedOrder : null}
        note={cancelNote}
        onNoteChange={setCancelNote}
        refundAmount={cancelRefundAmount}
        onRefundAmountChange={setCancelRefundAmount}
        onClose={handleCloseCancelDialog}
        onConfirm={handleConfirmCancel}
        submitting={cancelMutation.isPending}
      />
      <ArticleModal
        article={selectedArticle}
        onClose={() => setSelectedArticleId(null)}
        mainCategoryOptions={mainCategoryOptions}
        categoryOptions={articleCategories}
        returnCategoryOptions={returnCategoryOptions}
      />
      <PromoCodesModal open={promoCodesOpen} onClose={() => setPromoCodesOpen(false)} />
    </div>
  );
};

export default AdminDashboard;
