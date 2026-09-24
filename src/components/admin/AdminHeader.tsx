import { useState } from "react";
import { Search, LogOut, X, Tag } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/hooks/useTranslation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Button } from "@/components/ui/button";

interface AdminHeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  onOpenPromoCodes: () => void;
}

const DE_BARS = ["#1a1a1a", "#c1272d", "#d4af37"];

const Flag = ({ lang }: { lang: "de" | "en" }) => {
  if (lang === "en") {
    return (
      <svg
        viewBox="0 0 20 14"
        className="w-5 h-3.5 rounded-sm overflow-hidden shrink-0 border border-black/10"
      >
        <rect width="20" height="14" fill="#1c2b5c" />
        <path d="M0,0 L20,14 M20,0 L0,14" stroke="#ffffff" strokeWidth="2.8" />
        <path d="M0,0 L20,14 M20,0 L0,14" stroke="#c1272d" strokeWidth="1.2" />
        <path d="M10,0 V14 M0,7 H20" stroke="#ffffff" strokeWidth="4.2" />
        <path d="M10,0 V14 M0,7 H20" stroke="#c1272d" strokeWidth="2.2" />
      </svg>
    );
  }
  return (
    <span className="w-5 h-3.5 rounded-sm overflow-hidden flex flex-col shrink-0 border border-black/10">
      {DE_BARS.map((bg, i) => (
        <span key={i} className="flex-1" style={{ background: bg }} />
      ))}
    </span>
  );
};

export const AdminHeader = ({ search, onSearchChange, onOpenPromoCodes }: AdminHeaderProps) => {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();
  const { auth, logout } = useAdminAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-[hsl(220_13%_91%)] px-3 sm:px-8 py-2.5 sm:py-3.5 flex items-center gap-2 sm:gap-6 flex-nowrap">
      <div className="leading-tight shrink-0">
        <div className="text-[14px] sm:text-[19px] font-bold whitespace-nowrap">{t("adminDashboardWord")}</div>
        <div className="text-[10px] sm:text-[13px] text-[hsl(220_13%_55%)] whitespace-nowrap">Veloclub Horgen</div>
      </div>

      <div className="flex-1 min-w-0 max-w-[680px] mx-auto relative">
        <Search
          className="absolute left-2.5 sm:left-[15px] top-1/2 -translate-y-1/2 pointer-events-none text-[hsl(220_13%_55%)]"
          size={17}
        />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("adminSearchPlaceholder")}
          className="w-full box-border py-2 sm:py-[11px] pl-8 sm:pl-[42px] pr-8 sm:pr-9 rounded-[10px] border border-[hsl(220_13%_88%)] bg-[hsl(210_30%_97%)] text-sm outline-none text-[hsl(220_13%_18%)]"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            title={t("adminClearSearch")}
            aria-label={t("adminClearSearch")}
            className="absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-full text-[hsl(220_13%_55%)] hover:bg-[hsl(220_13%_88%)] hover:text-[hsl(220_13%_30%)] cursor-pointer"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <Button
          variant="outline"
          size="icon"
          onClick={onOpenPromoCodes}
          title={t("adminPromoCodes")}
          aria-label={t("adminPromoCodes")}
          className="text-[hsl(220_13%_35%)] h-9 w-9 shrink-0"
        >
          <Tag size={16} />
        </Button>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 sm:gap-2 border border-[hsl(220_13%_88%)] bg-white px-2 sm:px-3 py-[7px] rounded-lg cursor-pointer"
          >
            <Flag lang={language} />
            <span className="hidden sm:inline text-[10px] text-[hsl(220_13%_55%)]">▾</span>
          </button>
          {menuOpen && (
            <div className="absolute top-[calc(100%+6px)] right-0 bg-white border border-[hsl(220_13%_90%)] rounded-[10px] shadow-lg overflow-hidden z-40 min-w-[140px]">
              {(["de", "en"] as const).map((l, i) => (
                <button
                  key={l}
                  onClick={() => {
                    setLanguage(l);
                    setMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 border-none bg-white cursor-pointer text-[13px] text-left ${
                    i > 0 ? "border-t border-[hsl(220_13%_93%)]" : ""
                  }`}
                >
                  <Flag lang={l} />
                  {l === "de" ? "Deutsch" : "English"}
                </button>
              ))}
            </div>
          )}
        </div>
        {auth && (
          <span className="hidden sm:inline text-[13px] text-[hsl(220_13%_45%)] truncate max-w-[160px]">
            {auth.record.name || auth.record.email}
          </span>
        )}
        {auth && (
          <Button
            variant="outline"
            size="icon"
            onClick={logout}
            title={t("adminLogout")}
            aria-label={t("adminLogout")}
            className="text-[hsl(220_13%_35%)] h-9 w-9 shrink-0"
          >
            <LogOut size={16} />
          </Button>
        )}
      </div>
    </div>
  );
};
