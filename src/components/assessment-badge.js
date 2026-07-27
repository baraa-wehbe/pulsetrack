import { STATUS_BADGE_RADIUS_CLASS } from "@/components/badge-styles";
import {
  getAssessmentStatusPresentation,
  getRiskPresentation,
} from "@/lib/assessment-presentation";

const variants = {
  neutral:
    "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  blue: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200",
  green:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  amber:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  orange:
    "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200",
  red: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
};

export default function AssessmentBadge({ kind, messages, value }) {
  const presentation =
    kind === "risk"
      ? getRiskPresentation(value)
      : getAssessmentStatusPresentation(value);

  return (
    <span
      className={`inline-flex border px-2.5 py-1 text-xs font-bold ${STATUS_BADGE_RADIUS_CLASS} ${variants[presentation.variant]}`}
    >
      {messages[presentation.translationKey]}
    </span>
  );
}
