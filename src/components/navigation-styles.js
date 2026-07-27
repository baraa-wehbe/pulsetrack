import { CONTROL_RADIUS_CLASS } from "@/components/control-styles";

export const navigationItemClass = (active) =>
  `${CONTROL_RADIUS_CLASS} px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${
    active
      ? "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
  }`;
