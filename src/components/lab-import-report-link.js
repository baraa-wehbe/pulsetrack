import Link from "next/link";

export default function LabImportReportLink({ labImport, messages }) {
  return (
    <Link
      aria-label={`${messages.viewImportValidation}: ${labImport.originalFileName}`}
      className="group relative inline-flex items-center gap-1.5 rounded-md bg-teal-50 px-2 py-1 font-bold text-teal-800 underline decoration-teal-400 decoration-dotted underline-offset-4 transition hover:bg-teal-100 hover:text-teal-950 hover:decoration-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:bg-teal-950/70 dark:text-teal-200 dark:hover:bg-teal-900"
      href={`/lab-uploads/${encodeURIComponent(labImport.id)}`}
      title={messages.viewImportReportTooltip}
    >
      <bdi dir="ltr">{labImport.originalFileName}</bdi>
      <svg
        aria-hidden="true"
        className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
        fill="none"
        viewBox="0 0 16 16"
      >
        <path
          d="M5 3h8v8M13 3 3 13"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.75"
        />
      </svg>
      <span
        className="pointer-events-none absolute start-1/2 top-full z-20 mt-2 w-max max-w-52 -translate-x-1/2 rounded-lg bg-slate-950 px-2.5 py-1.5 text-center text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-white dark:text-slate-950"
        role="tooltip"
      >
        {messages.viewImportReportTooltip}
      </span>
    </Link>
  );
}
