const WIDTH = 720;
const HEIGHT = 260;
const PADDING = { top: 24, end: 24, bottom: 48, start: 64 };

const formatValue = (value) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);

export default function TimeSeriesChart({
  accessibleLabel,
  dateLabel,
  points,
  unit,
  valueLabel,
}) {
  const values = points.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = rawMax - rawMin || Math.max(Math.abs(rawMax) * 0.1, 1);
  const minimum = rawMin - spread * 0.15;
  const maximum = rawMax + spread * 0.15;
  const plotWidth = WIDTH - PADDING.start - PADDING.end;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const coordinates = points.map((point, index) => ({
    ...point,
    x:
      PADDING.start +
      (points.length === 1
        ? plotWidth / 2
        : (index / (points.length - 1)) * plotWidth),
    y:
      PADDING.top +
      ((maximum - point.value) / (maximum - minimum)) * plotHeight,
  }));

  return (
    <div>
      <svg
        aria-label={accessibleLabel}
        className="h-auto w-full overflow-visible"
        role="img"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        {[0, 0.5, 1].map((ratio) => {
          const y = PADDING.top + ratio * plotHeight;
          const value = maximum - ratio * (maximum - minimum);
          return (
            <g key={ratio}>
              <line
                className="stroke-slate-200 dark:stroke-slate-700"
                x1={PADDING.start}
                x2={WIDTH - PADDING.end}
                y1={y}
                y2={y}
              />
              <text
                className="fill-slate-500 text-[11px] dark:fill-slate-400"
                textAnchor="end"
                x={PADDING.start - 10}
                y={y + 4}
              >
                {formatValue(value)}
              </text>
            </g>
          );
        })}
        {coordinates.length > 1 && (
          <polyline
            className="fill-none stroke-teal-600 dark:stroke-teal-400"
            points={coordinates.map(({ x, y }) => `${x},${y}`).join(" ")}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
        )}
        {coordinates.map(({ date, value, x, y }, index) => (
          <g key={`${date}-${index}`}>
            <circle
              className="fill-white stroke-teal-700 dark:fill-slate-900 dark:stroke-teal-300"
              cx={x}
              cy={y}
              r="5"
              strokeWidth="3"
            />
            {(index === 0 || index === coordinates.length - 1) && (
              <text
                className="fill-slate-600 text-[11px] dark:fill-slate-300"
                textAnchor={index === 0 ? "start" : "end"}
                x={x}
                y={HEIGHT - 18}
              >
                {date.slice(0, 10)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <table className="sr-only">
        <caption>{accessibleLabel}</caption>
        <thead>
          <tr>
            <th scope="col">{dateLabel}</th>
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point, index) => (
            <tr key={`${point.date}-${index}`}>
              <td>{point.date.slice(0, 10)}</td>
              <td>
                {formatValue(point.value)} {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
