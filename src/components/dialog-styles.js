export const DIALOG_OVERLAY_CLASS =
  "fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in";

export const DIALOG_CONTENT_CLASS =
  "fixed start-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(94vw,52rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl outline-none sm:p-8 rtl:translate-x-1/2 dark:border-slate-700 dark:bg-slate-900";

export const DIALOG_CLOSE_CLASS =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:text-slate-300 dark:hover:bg-slate-800";

export const DIALOG_FOOTER_CLASS =
  "flex w-full flex-wrap items-center justify-end gap-3 rtl:justify-start";
