import { CHART_HEIGHT } from "@/components/chart-theme";

export default function ChartSkeleton({ label = "Loading chart" }) {
  return (
    <div
      aria-label={label}
      className="clinical-skeleton w-full rounded-xl"
      role="status"
      style={{ height: CHART_HEIGHT }}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}
