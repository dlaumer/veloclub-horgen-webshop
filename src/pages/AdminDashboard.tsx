import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useTranslation } from "@/hooks/useTranslation";
import { useToast } from "@/hooks/use-toast";
import { listOrders, listOrderItems, listLogs, updateOrder, parseTriState } from "@/lib/adminApi";
import { fetchStock } from "@/lib/stockApi";
import { inRange, RangeMode } from "@/lib/adminFormat";
import { cn } from "@/lib/utils";
import { EnrichedOrder, EnrichedArticle, EnrichedLog } from "@/types/admin";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { OrdersPanel } from "@/components/admin/OrdersPanel";
import { LogPanel, LogKindFilter } from "@/components/admin/LogPanel";
import { ArticlesPanel } from "@/components/admin/ArticlesPanel";
import { OrderModal } from "@/components/admin/OrderModal";
import { ArticleModal } from "@/components/admin/ArticleModal";
import { MobileTabBar, MobileTab } from "@/components/admin/MobileTabBar";

const PLACEHOLDER_IMG = "/placeholder.svg";

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

  const loadError =
    ordersQuery.isError || orderItemsQuery.isError || logsQuery.isError || stockQuery.isError;

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
        image: it.expand?.article?.image_urls?.[0] || PLACEHOLDER_IMG,
        isReturn: !!it.is_return,
      }));
      const itemCount = items.reduce((s, it) => s + it.quantity, 0);
      return {
        ...o,
        fullName: `${o.buyer_name} ${o.buyer_lastname}`.trim(),
        itemCount,
        items,
      };
    });
  }, [orders, orderItems]);

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
    const revenue = filteredOrders.filter((o) => !o.cancelled).reduce((s, o) => s + (o.amount_paid || 0), 0);
    const notCollected = filteredOrders.filter((o) => !o.cancelled && parseTriState(o.picked_up) === false).length;
    return { count: filteredOrders.length, revenue, notCollected };
  }, [filteredOrders]);

  const enrichedLogs: EnrichedLog[] = useMemo(
    () =>
      logs.map((l) => {
        const order = ordersById[l.order];
        return {
          ...l,
          orderNumber: order?.order_number || "",
          fullName: order?.fullName || "",
          placedAt: order?.placed_at || order?.created || "",
        };
      }),
    [logs, ordersById],
  );

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
        list.push({
          id: color.id,
          articleNumber: color.id,
          productId: product.id,
          name: product.name,
          price: product.price,
          image: color.images?.[0] || product.image || PLACEHOLDER_IMG,
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
    onSettled: () => {
      setBusyOrderId(null);
      setSelectedOrderId(null);
    },
  });

  const handleMarkReady = () => {
    if (!selectedOrder) return;
    // ready/picked_up are tri-state TEXT fields - the backend hooks compare
    // against the literal string "yes", not a JS boolean.
    orderMutation.mutate({ id: selectedOrder.id, patch: { ready: "yes" } });
  };

  const handleMarkPicked = () => {
    if (!selectedOrder) return;
    orderMutation.mutate({ id: selectedOrder.id, patch: { picked_up: "yes" } });
  };

  const handleCancel = () => {
    if (!selectedOrder) return;
    if (!window.confirm(t("adminCancelConfirm"))) return;
    const note = window.prompt(t("adminCancelNotePrompt")) || "";
    orderMutation.mutate({ id: selectedOrder.id, patch: { cancelled: true, cancelled_note: note } });
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[hsl(0_0%_98%)] text-[hsl(220_13%_18%)]">
      <div className="shrink-0">
        <AdminHeader search={search} onSearchChange={setSearch} />
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
        busy={orderMutation.isPending && busyOrderId === selectedOrder?.id}
      />
      <ArticleModal article={selectedArticle} onClose={() => setSelectedArticleId(null)} />
    </div>
  );
};

export default AdminDashboard;
