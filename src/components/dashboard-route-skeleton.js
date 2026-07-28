import ChartSkeleton from "@/components/chart-skeleton";

export default function DashboardRouteSkeleton({ chartCards = 2 }) {
  return (
    <section aria-busy="true" aria-label="Loading dashboard" role="status">
      <div className="clinical-skeleton h-10 max-w-sm rounded-xl" />
      <div className="clinical-skeleton mt-3 h-5 max-w-2xl rounded-lg" />
      <div className="clinical-skeleton mt-6 h-24 rounded-2xl" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div className="clinical-skeleton h-28 rounded-2xl" key={index} />
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        {Array.from({ length: chartCards }, (_, index) => (
          <div className="dashboard-chart-card" key={index}>
            <div className="clinical-skeleton h-6 w-44 rounded-lg" />
            <div className="mt-4">
              <ChartSkeleton />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
