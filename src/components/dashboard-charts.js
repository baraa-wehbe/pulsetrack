const colors = [
  "#0f766e",
  "#2563eb",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#64748b",
];

export const DonutChart = ({ accessibleLabel, items }) => {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let offset = 0;

  return (
    <div className="grid gap-5 sm:grid-cols-[9rem_1fr] sm:items-center">
      <div
        aria-label={accessibleLabel}
        className="clinical-chart-ring relative mx-auto size-32 rounded-full shadow-[inset_0_0_0_1px_rgb(15_118_110_/_0.08)]"
        role="img"
        style={{
          background:
            total === 0
              ? "#e2e8f0"
              : `conic-gradient(${items
                  .filter((item) => item.value > 0)
                  .map((item, index) => {
                    const start = (offset / total) * 100;
                    offset += item.value;
                    const end = (offset / total) * 100;
                    return `${colors[index % colors.length]} ${start}% ${end}%`;
                  })
                  .join(",")})`,
        }}
      >
        <div className="absolute inset-5 grid place-items-center rounded-full bg-white text-center dark:bg-slate-900">
          <span className="text-2xl font-black">{total}</span>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {items.map((item, index) => (
          <li
            className="flex items-center justify-between gap-3"
            key={item.label}
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full"
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              {item.label}
            </span>
            <strong>{item.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const HorizontalBarChart = ({ accessibleLabel, items }) => {
  const maximum = Math.max(1, ...items.map((item) => item.value));

  return (
    <div aria-label={accessibleLabel} className="space-y-3" role="img">
      {items.map((item, index) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="clinical-chart-bar h-full rounded-full"
              style={{
                backgroundColor: colors[index % colors.length],
                width: `${(item.value / maximum) * 100}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
