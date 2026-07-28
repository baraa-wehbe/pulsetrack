"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_HEIGHT, chartTheme } from "@/components/chart-theme";

const initialDimension = { height: CHART_HEIGHT, width: 640 };

const AccessibleDataTable = ({ accessibleLabel, items }) => (
  <table className="sr-only">
    <caption>{accessibleLabel}</caption>
    <thead>
      <tr>
        <th scope="col">Category</th>
        <th scope="col">Value</th>
      </tr>
    </thead>
    <tbody>
      {items.map((item) => (
        <tr key={item.label}>
          <td>{item.label}</td>
          <td>{item.value}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export const DonutChart = ({ accessibleLabel, items }) => {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const data =
    total === 0 ? [{ label: accessibleLabel, value: 1, empty: true }] : items;

  return (
    <>
      <ResponsiveContainer
        height={CHART_HEIGHT}
        initialDimension={initialDimension}
        minHeight={CHART_HEIGHT}
        width="100%"
      >
        <PieChart
          accessibilityLayer
          aria-label={accessibleLabel}
          margin={{ bottom: 12, left: 8, right: 8, top: 8 }}
          role="img"
        >
          <Pie
            {...chartTheme.animation}
            cornerRadius={5}
            data={data}
            dataKey="value"
            innerRadius="56%"
            nameKey="label"
            outerRadius="78%"
            paddingAngle={total === 0 ? 0 : 2}
          >
            {data.map((item, index) => (
              <Cell
                fill={
                  item.empty
                    ? "var(--chart-empty)"
                    : chartTheme.colors[index % chartTheme.colors.length]
                }
                key={item.label}
              />
            ))}
            <Label
              fill="var(--chart-label)"
              fontSize={26}
              fontWeight={800}
              position="center"
              value={total}
            />
          </Pie>
          {total > 0 ? <Tooltip {...chartTheme.tooltip} /> : null}
          {total > 0 ? <Legend {...chartTheme.legend} /> : null}
        </PieChart>
      </ResponsiveContainer>
      <AccessibleDataTable accessibleLabel={accessibleLabel} items={items} />
    </>
  );
};

export const HorizontalBarChart = ({ accessibleLabel, items }) => {
  return (
    <>
      <ResponsiveContainer
        height={CHART_HEIGHT}
        initialDimension={initialDimension}
        minHeight={CHART_HEIGHT}
        width="100%"
      >
        <BarChart
          accessibilityLayer
          aria-label={accessibleLabel}
          data={items}
          layout="vertical"
          margin={{ bottom: 8, left: 4, right: 28, top: 8 }}
          role="img"
        >
          <CartesianGrid {...chartTheme.grid} horizontal={false} vertical />
          <XAxis {...chartTheme.axis} allowDecimals={false} type="number" />
          <YAxis
            {...chartTheme.axis}
            dataKey="label"
            type="category"
            width={118}
          />
          <Tooltip {...chartTheme.tooltip} />
          <Bar
            {...chartTheme.animation}
            dataKey="value"
            name={accessibleLabel}
            radius={[0, 6, 6, 0]}
          >
            {items.map((item, index) => (
              <Cell
                fill={chartTheme.colors[index % chartTheme.colors.length]}
                key={item.label}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <AccessibleDataTable accessibleLabel={accessibleLabel} items={items} />
    </>
  );
};
