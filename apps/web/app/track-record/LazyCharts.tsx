"use client";
// T-295: Recharts (~100 kB gzipped) loads after the page instead of with it. The charts sit below the tiles and
// ResponsiveContainer draws nothing on the server anyway (no width there), so nothing visible is lost. Each placeholder
// holds the chart's height so the page does not jump when it arrives; the tables under each chart are server-rendered.
import dynamic from "next/dynamic";

const box = (h: number) => function ChartLoading() {
  return <div aria-hidden="true" className="animate-pulse rounded-inner bg-muted-bg" style={{ height: h }} />;
};

export const FoldCharts = dynamic(() => import("./Charts").then((m) => m.FoldCharts), { ssr: false, loading: box(362) });
export const EdgeChart = dynamic(() => import("./Charts").then((m) => m.EdgeChart), { ssr: false, loading: box(260) });
export const CalibrationChart = dynamic(() => import("./Charts").then((m) => m.CalibrationChart), { ssr: false, loading: box(400) });
