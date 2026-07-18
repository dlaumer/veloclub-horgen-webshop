import { ClipboardList, Activity, Package } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

export type MobileTab = "orders" | "log" | "stock";

interface MobileTabBarProps {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
}

export const MobileTabBar = ({ active, onChange }: MobileTabBarProps) => {
  const { t } = useTranslation();

  const tabs: { id: MobileTab; label: string; Icon: typeof ClipboardList }[] = [
    { id: "orders", label: t("adminOrdersTitle"), Icon: ClipboardList },
    { id: "log", label: t("adminLogTitle"), Icon: Activity },
    { id: "stock", label: t("adminArticlesTitle"), Icon: Package },
  ];

  return (
    <div
      className="xl:hidden shrink-0 bg-white border-t border-[hsl(220_13%_91%)] flex"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 cursor-pointer",
              isActive ? "text-[hsl(227_69%_31%)]" : "text-[hsl(220_13%_55%)]",
            )}
          >
            <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
            <span className={cn("text-[11px]", isActive ? "font-semibold" : "font-medium")}>{label}</span>
          </button>
        );
      })}
    </div>
  );
};
