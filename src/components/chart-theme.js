export const CHART_HEIGHT = 300;
export const CHART_ANIMATION_DURATION = 850;

export const chartTheme = Object.freeze({
  animation: Object.freeze({
    animationDuration: CHART_ANIMATION_DURATION,
    animationEasing: "ease-out",
    isAnimationActive: true,
  }),
  axis: Object.freeze({
    axisLine: false,
    tick: Object.freeze({
      fill: "var(--chart-tick)",
      fontSize: 12,
      fontWeight: 600,
    }),
    tickLine: false,
  }),
  colors: Object.freeze([
    "var(--chart-series-1)",
    "var(--chart-series-2)",
    "var(--chart-series-3)",
    "var(--chart-series-4)",
    "var(--chart-series-5)",
  ]),
  grid: Object.freeze({
    stroke: "var(--chart-grid)",
    strokeDasharray: "3 5",
  }),
  legend: Object.freeze({
    iconSize: 9,
    iconType: "circle",
    wrapperStyle: Object.freeze({
      color: "var(--chart-tick)",
      fontSize: "0.75rem",
      fontWeight: 600,
      paddingTop: "0.75rem",
    }),
  }),
  seriesStrokeWidth: 3,
  tooltip: Object.freeze({
    contentStyle: Object.freeze({
      background: "var(--chart-tooltip-bg)",
      border: "1px solid var(--chart-tooltip-border)",
      borderRadius: "0.75rem",
      boxShadow: "0 12px 30px rgb(15 23 42 / 0.12)",
      color: "var(--chart-tooltip-text)",
      fontSize: "0.8rem",
    }),
    cursor: Object.freeze({
      fill: "var(--chart-cursor)",
      stroke: "var(--chart-cursor)",
    }),
    itemStyle: Object.freeze({
      color: "var(--chart-tooltip-text)",
      fontWeight: 700,
    }),
    labelStyle: Object.freeze({
      color: "var(--chart-tooltip-muted)",
      fontWeight: 700,
      marginBottom: "0.25rem",
    }),
  }),
});
