import { getPatientBadge } from "@/lib/patient-list";
import { CONTROL_RADIUS_CLASS } from "@/components/control-styles";

const variants = {
  neutral:
    "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  teal: "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-200",
  blue: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200",
  amber:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  green:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  red: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
};

export default function PatientBadge({ kind, messages, value }) {
  const mapping = getPatientBadge(kind, value);
  const label = messages[mapping.translationKey];
  const description = messages[mapping.descriptionKey];

  return (
    <span
      aria-label={`${label}. ${description}`}
      className={`inline-flex max-w-full items-center border px-2.5 py-1 text-xs font-semibold ${CONTROL_RADIUS_CLASS} ${variants[mapping.variant]}`}
      title={description}
    >
      {label}
    </span>
  );
}
