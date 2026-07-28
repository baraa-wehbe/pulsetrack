const SIZE = 96;
const STROKE_WIDTH = 9;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function PercentageGauge({ label, value }) {
  const normalizedValue = Math.min(100, Math.max(0, Number(value) || 0));
  const offset = CIRCUMFERENCE * (1 - normalizedValue / 100);

  return (
    <svg
      aria-label={`${label}: ${normalizedValue.toFixed(1)}%`}
      className="size-20 shrink-0"
      role="img"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
    >
      <circle
        className="stroke-slate-200 dark:stroke-slate-700"
        cx={SIZE / 2}
        cy={SIZE / 2}
        fill="none"
        r={RADIUS}
        strokeWidth={STROKE_WIDTH}
      />
      <circle
        className="stroke-teal-600 dark:stroke-teal-400"
        cx={SIZE / 2}
        cy={SIZE / 2}
        fill="none"
        r={RADIUS}
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        strokeLinecap="round"
        strokeWidth={STROKE_WIDTH}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
      >
        <animate
          attributeName="stroke-dashoffset"
          dur="850ms"
          fill="freeze"
          from={CIRCUMFERENCE}
          to={offset}
        />
      </circle>
    </svg>
  );
}
