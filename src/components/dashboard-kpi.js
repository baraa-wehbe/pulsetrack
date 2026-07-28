import PercentageGauge from "@/components/percentage-gauge";

export default function DashboardKpi({ gaugeValue, label, note, value }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-teal-500 via-cyan-400 to-transparent"
      />
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">
          <bdi dir="ltr">{value}</bdi>
        </p>
        {gaugeValue == null ? null : (
          <PercentageGauge label={label} value={gaugeValue} />
        )}
      </div>
      {note ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {note}
        </p>
      ) : null}
    </article>
  );
}
