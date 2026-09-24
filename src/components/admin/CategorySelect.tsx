import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";

interface CategorySelectProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

const ADD_NEW = "__add_new__";

/**
 * A dropdown for "categorical" text fields (main_category, category,
 * return_category, ...) that aren't backed by a fixed enum in the schema -
 * they're just plain text fields where, in practice, values repeat across
 * articles. `options` should be the *live* set of distinct values currently
 * in use (derived from existing articles by the caller) so the list always
 * reflects reality: pick "+ Add new" to type a value that doesn't exist
 * yet, and once it's saved on at least one article it'll show up here next
 * time (and disappears again once no article uses it anymore) - no
 * separate categories list is stored anywhere.
 */
export const CategorySelect = ({ value, options, onChange }: CategorySelectProps) => {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  // Always include the current value, even if it's not (yet, or anymore)
  // part of the live option set - otherwise this field's own value could
  // silently vanish from the dropdown the moment you open it.
  const allOptions = Array.from(new Set([...(value ? [value] : []), ...options])).sort((a, b) =>
    a.localeCompare(b),
  );

  const commitDraft = () => {
    const v = draft.trim();
    if (v) onChange(v);
    setAdding(false);
    setDraft("");
  };

  if (adding) {
    return (
      <Input
        autoFocus
        value={draft}
        placeholder={t("adminNewCategoryPlaceholder")}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitDraft();
          } else if (e.key === "Escape") {
            setAdding(false);
            setDraft("");
          }
        }}
      />
    );
  }

  return (
    <select
      className="w-full h-10 min-w-0 rounded-md border border-[hsl(220_13%_88%)] bg-background px-3 text-sm"
      value={value}
      onChange={(e) => {
        if (e.target.value === ADD_NEW) {
          setAdding(true);
          return;
        }
        onChange(e.target.value);
      }}
    >
      {!value && <option value="">—</option>}
      {allOptions.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
      <option value={ADD_NEW}>{t("adminAddNewOption")}</option>
    </select>
  );
};
