// Small shared badge styling helpers for order ready/picked-up/kidzbike
// state, matching the Claude Design mockup's color scheme.
//
// Orders imported from the legacy Excel sheet can leave a flag genuinely
// unset (neither true nor false) - that's rendered as N/A rather than a
// misleading "No".

import { CheckCircle2, Circle, XCircle, HelpCircle, PackageCheck, Package, LucideIcon } from "lucide-react";
import { FlagValue, TriStateRaw, parseTriState } from "@/lib/adminApi";

interface BadgeInfo {
  className: string;
  label: string;
}

interface IconBadgeInfo {
  Icon: LucideIcon;
  className: string;
  label: string;
}

const BASE = "inline-block px-[9px] py-1 rounded-md text-[11.5px] font-semibold text-center";
const NEUTRAL = `${BASE} bg-[hsl(220_13%_94%)] text-[hsl(220_13%_55%)]`;

/** True if `v` resolves to an actual true/false (not null/undefined/"no data"). */
export function isFlagSet(v: TriStateRaw): boolean {
  return parseTriState(v) !== null;
}

export function readyBadge(
  ready: TriStateRaw,
  cancelled: FlagValue,
  i18n: { yes: string; no: string; cancelled: string; na: string },
): BadgeInfo {
  if (parseTriState(cancelled) === true) {
    return { className: NEUTRAL, label: i18n.cancelled };
  }
  const r = parseTriState(ready);
  if (r === null) {
    return { className: NEUTRAL, label: i18n.na };
  }
  if (r) {
    return { className: `${BASE} bg-[hsl(45_90%_92%)] text-[hsl(35_75%_35%)]`, label: i18n.yes };
  }
  return { className: NEUTRAL, label: i18n.no };
}

export function pickedBadge(pickedUp: TriStateRaw, i18n: { yes: string; no: string; na: string }): BadgeInfo {
  const p = parseTriState(pickedUp);
  if (p === null) {
    return { className: NEUTRAL, label: i18n.na };
  }
  if (p) {
    return { className: `${BASE} bg-[hsl(150_45%_92%)] text-[hsl(150_45%_28%)]`, label: i18n.yes };
  }
  return { className: NEUTRAL, label: i18n.no };
}

/** Icon version of readyBadge, for compact (mobile) display. */
export function readyIcon(
  ready: TriStateRaw,
  cancelled: FlagValue,
  i18n: { yes: string; no: string; cancelled: string; na: string },
): IconBadgeInfo {
  if (parseTriState(cancelled) === true) {
    return { Icon: XCircle, className: "text-[hsl(0_74%_50%)]", label: i18n.cancelled };
  }
  const r = parseTriState(ready);
  if (r === null) {
    return { Icon: HelpCircle, className: "text-[hsl(220_13%_65%)]", label: i18n.na };
  }
  if (r) {
    return { Icon: CheckCircle2, className: "text-[hsl(35_75%_40%)]", label: i18n.yes };
  }
  return { Icon: Circle, className: "text-[hsl(220_13%_80%)]", label: i18n.no };
}

/** Icon version of pickedBadge, for compact (mobile) display. */
export function pickedIcon(pickedUp: TriStateRaw, i18n: { yes: string; no: string; na: string }): IconBadgeInfo {
  const p = parseTriState(pickedUp);
  if (p === null) {
    return { Icon: HelpCircle, className: "text-[hsl(220_13%_65%)]", label: i18n.na };
  }
  if (p) {
    return { Icon: PackageCheck, className: "text-[hsl(150_45%_32%)]", label: i18n.yes };
  }
  return { Icon: Package, className: "text-[hsl(220_13%_80%)]", label: i18n.no };
}

/** Generic yes/no/N-A badge, used for e.g. the KidzBike flag. */
export function flagBadge(value: TriStateRaw, i18n: { yes: string; no: string; na: string }): BadgeInfo {
  const v = parseTriState(value);
  if (v === null) {
    return { className: NEUTRAL, label: i18n.na };
  }
  if (v) {
    return { className: `${BASE} bg-[hsl(227_69%_95%)] text-[hsl(227_69%_35%)]`, label: i18n.yes };
  }
  return { className: NEUTRAL, label: i18n.no };
}
