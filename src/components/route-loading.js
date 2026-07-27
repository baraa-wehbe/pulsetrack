const SkeletonCard = ({ compact = false }) => (
  <div
    className={`clinical-skeleton rounded-2xl ${compact ? "h-28" : "h-44"}`}
  />
);

export default function RouteLoading({
  cards = 4,
  compact = false,
  status,
  title,
}) {
  return (
    <section aria-live="polite" className="space-y-7" role="status">
      <div className="flex items-center gap-4">
        <span className="clinical-loading-orbit" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl dark:text-white">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {status}
          </p>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {Array.from({ length: cards }, (_, index) => (
          <SkeletonCard compact={compact} key={index} />
        ))}
      </div>
    </section>
  );
}
