export default function DashboardKpi({ label, note, value }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
        <bdi dir="ltr">{value}</bdi>
      </p>
      {note ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {note}
        </p>
      ) : null}
    </article>
  );
}
