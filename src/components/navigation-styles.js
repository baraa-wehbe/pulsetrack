import { CONTROL_RADIUS_CLASS } from "@/components/control-styles";

export const navigationItemClass = (active) =>
  `${CONTROL_RADIUS_CLASS} border px-3.5 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${
    active
      ? "border-teal-200 bg-teal-50 text-teal-900 shadow-[inset_0_0_0_1px_rgb(13_148_136_/_0.04)] dark:border-teal-800 dark:bg-teal-950 dark:text-teal-100"
      : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white/80 hover:text-slate-950 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900/80 dark:hover:text-white"
  }`;
