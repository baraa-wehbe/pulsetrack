export default function ChartCard({ children, description, title }) {
  return (
    <section className="dashboard-chart-card">
      <div>
        <h2 className="text-lg font-bold text-slate-950 dark:text-white">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        ) : null}
      </div>
      <div className="mt-4 min-h-[18.75rem]">{children}</div>
    </section>
  );
}
