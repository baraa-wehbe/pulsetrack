"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_HEIGHT, chartTheme } from "@/components/chart-theme";

const formatValue = (value) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);

export default function TimeSeriesChart({
  accessibleLabel,
  dateLabel,
  points,
  unit,
  valueLabel,
}) {
  return (
    <>
      <ResponsiveContainer
        height={CHART_HEIGHT}
        initialDimension={{ height: CHART_HEIGHT, width: 720 }}
        minHeight={CHART_HEIGHT}
        width="100%"
      >
        <LineChart
          accessibilityLayer
          aria-label={accessibleLabel}
          data={points}
          margin={{ bottom: 8, left: 0, right: 16, top: 12 }}
          role="img"
        >
          <CartesianGrid {...chartTheme.grid} vertical={false} />
          <XAxis
            {...chartTheme.axis}
            dataKey="date"
            minTickGap={32}
            tickFormatter={(value) => value.slice(0, 10)}
          />
          <YAxis
            {...chartTheme.axis}
            domain={["auto", "auto"]}
            tickFormatter={formatValue}
            width={54}
          />
          <Tooltip
            {...chartTheme.tooltip}
            formatter={(value) => [
              `${formatValue(value)} ${unit}`.trim(),
              valueLabel,
            ]}
            labelFormatter={(value) => value.slice(0, 10)}
          />
          <Line
            {...chartTheme.animation}
            activeDot={{ r: 5, strokeWidth: 2 }}
            dataKey="value"
            dot={{ fill: "var(--chart-surface)", r: 4, strokeWidth: 2 }}
            name={valueLabel}
            stroke={chartTheme.colors[0]}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={chartTheme.seriesStrokeWidth}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
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
    </>
  );
}
