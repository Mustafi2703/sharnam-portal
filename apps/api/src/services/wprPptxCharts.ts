/**
 * Native PowerPoint chart slides for WPR export — editable in PowerPoint like client deck.
 */
import type { WprChartPack, WprBarPoint, WprPiePoint } from "./wprCharts.js";

const BRAND = "156082";
const NAVY = "0E2841";
const NAVY_XL = "002060";
const ORANGE = "E97132";
const BLUE = "2563EB";
const DARK = "1A1D26";
const MUTED = "5C6578";
const WHITE = "FFFFFF";
const LIGHT = "F0F2F5";
const SLIDE_W = 13.333;
const MARGIN = 0.45;
const CONTENT_W = SLIDE_W - MARGIN * 2;
const FOOTER_Y = 7.12;

const CHART_PALETTE = ["0F766E", "2563EB", "C45C26", "7C3AED", "059669", "DB2777", "0891B2", "D97706"];

export type WprChartSlideKey =
  | "dashboardKpis"
  | "scurve"
  | "milestones"
  | "manpower"
  | "cashflow"
  | "drawingDci"
  | "plannedVsActual"
  | "quality"
  | "safety";

export const WPR_CHART_SLIDE_ORDER: WprChartSlideKey[] = [
  "dashboardKpis",
  "scurve",
  "milestones",
  "manpower",
  "cashflow",
  "drawingDci",
  "plannedVsActual",
  "quality",
  "safety",
];

type PptxSlide = {
  background: { color: string };
  addText: (text: string | string[] | unknown, opts: Record<string, unknown>) => void;
  addShape: (type: string, opts: Record<string, unknown>) => void;
  addChart: (type: string, data: unknown[], opts?: Record<string, unknown>) => void;
};

export type PptxDeckCharts = {
  ShapeType: { rect: string };
  ChartType: { bar: string; line: string; doughnut: string };
  addSlide: () => PptxSlide;
};

function slideHeader(slide: PptxSlide, pptx: PptxDeckCharts, title: string, client?: string) {
  slide.background = { color: WHITE };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SLIDE_W, h: 0.08, fill: { color: BRAND } });
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0.08, w: SLIDE_W, h: 0.035, fill: { color: ORANGE } });
  slide.addText(client || "Sharnam PMC", {
    x: MARGIN,
    y: 0.2,
    w: 8,
    h: 0.26,
    fontSize: 11,
    color: BRAND,
    bold: true,
  });
  slide.addText(title, {
    x: MARGIN,
    y: 0.48,
    w: CONTENT_W,
    h: 0.4,
    fontSize: 20,
    bold: true,
    color: NAVY,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: MARGIN,
    y: 0.92,
    w: 1.55,
    h: 0.055,
    fill: { color: ORANGE },
  });
}

function footer(slide: PptxSlide, page: number, total: number, client?: string) {
  slide.addText(client || "Sharnam PMC", {
    x: MARGIN,
    y: FOOTER_Y,
    w: 8,
    h: 0.22,
    fontSize: 9,
    color: MUTED,
  });
  slide.addText(`${page} / ${total}`, {
    x: SLIDE_W - MARGIN - 1.6,
    y: FOOTER_Y,
    w: 1.6,
    h: 0.22,
    fontSize: 9,
    color: MUTED,
    align: "right",
  });
}

function trimBars(rows: WprBarPoint[], max = 12): WprBarPoint[] {
  const slice = rows.filter((r) => r.label).slice(0, max);
  if (slice.length) return slice;
  return [{ label: "No data yet", planned: 0, actual: 0 }];
}

function trimPie(rows: WprPiePoint[], max = 8): WprPiePoint[] {
  const slice = rows.filter((r) => r.label && r.value > 0).slice(0, max);
  if (slice.length) return slice;
  return [{ label: "Awaiting register data", value: 1 }];
}

function barChartSlide(
  pptx: PptxDeckCharts,
  opts: {
    title: string;
    subtitle?: string;
    bars: WprBarPoint[];
    valAxisTitle?: string;
    client?: string;
    page: number;
    total: number;
  }
) {
  const slide = pptx.addSlide();
  slideHeader(slide, pptx, opts.title, opts.client);
  if (opts.subtitle) {
    slide.addText(opts.subtitle, {
      x: MARGIN,
      y: 1.05,
      w: CONTENT_W,
      h: 0.3,
      fontSize: 10,
      color: MUTED,
    });
  }
  const bars = trimBars(opts.bars);
  const labels = bars.map((b) => b.label);
  const data = [
    { name: "Planned", labels, values: bars.map((b) => b.planned) },
    { name: "Actual", labels, values: bars.map((b) => b.actual) },
  ];
  slide.addChart(pptx.ChartType.bar, data, {
    x: MARGIN,
    y: opts.subtitle ? 1.4 : 1.15,
    w: CONTENT_W,
    h: 5.4,
    barDir: "col",
    barGrouping: "clustered",
    showLegend: true,
    legendPos: "b",
    legendFontSize: 9,
    chartColors: [BLUE, BRAND],
    valGridLine: { style: "dash", color: "E2E5EB" },
    catAxisLabelColor: MUTED,
    valAxisLabelColor: MUTED,
    catAxisLabelFontSize: 8,
    valAxisLabelFontSize: 8,
    showValAxisTitle: Boolean(opts.valAxisTitle),
    valAxisTitle: opts.valAxisTitle || "",
    valAxisTitleFontSize: 9,
    dataLabelColor: DARK,
    showValue: false,
  });
  footer(slide, opts.page, opts.total, opts.client);
}

function lineChartSlide(
  pptx: PptxDeckCharts,
  opts: {
    title: string;
    subtitle?: string;
    points: { label: string; planned: number; actual: number }[];
    client?: string;
    page: number;
    total: number;
  }
) {
  const slide = pptx.addSlide();
  slideHeader(slide, pptx, opts.title, opts.client);
  if (opts.subtitle) {
    slide.addText(opts.subtitle, {
      x: MARGIN,
      y: 1.05,
      w: CONTENT_W,
      h: 0.3,
      fontSize: 10,
      color: MUTED,
    });
  }
  const pts = opts.points.length ? opts.points.slice(-14) : [{ label: "—", planned: 0, actual: 0 }];
  const labels = pts.map((p) => p.label);
  const data = [
    { name: "Planned %", labels, values: pts.map((p) => p.planned) },
    { name: "Actual %", labels, values: pts.map((p) => p.actual) },
  ];
  slide.addChart(pptx.ChartType.line, data, {
    x: MARGIN,
    y: opts.subtitle ? 1.4 : 1.15,
    w: CONTENT_W,
    h: 5.4,
    showLegend: true,
    legendPos: "b",
    legendFontSize: 9,
    chartColors: [BLUE, BRAND],
    lineSize: 2.5,
    lineDataSymbol: "circle",
    lineDataSymbolSize: 5,
    valGridLine: { style: "dash", color: "E2E5EB" },
    catAxisLabelColor: MUTED,
    valAxisLabelColor: MUTED,
    catAxisLabelFontSize: 8,
    valAxisLabelFontSize: 8,
    showValAxisTitle: true,
    valAxisTitle: "Progress %",
    valAxisTitleFontSize: 9,
  });
  footer(slide, opts.page, opts.total, opts.client);
}

function pieChartSlide(
  pptx: PptxDeckCharts,
  opts: {
    title: string;
    subtitle?: string;
    slices: WprPiePoint[];
    client?: string;
    page: number;
    total: number;
  }
) {
  const slide = pptx.addSlide();
  slideHeader(slide, pptx, opts.title, opts.client);
  if (opts.subtitle) {
    slide.addText(opts.subtitle, {
      x: MARGIN,
      y: 1.05,
      w: CONTENT_W,
      h: 0.3,
      fontSize: 10,
      color: MUTED,
    });
  }
  const slices = trimPie(opts.slices);
  slide.addChart(
    pptx.ChartType.doughnut,
    [
      {
        name: opts.title,
        labels: slices.map((s) => s.label),
        values: slices.map((s) => s.value),
      },
    ],
    {
      x: 1.4,
      y: opts.subtitle ? 1.4 : 1.2,
      w: 7.2,
      h: 5.2,
      showLegend: true,
      legendPos: "r",
      legendFontSize: 9,
      showPercent: true,
      showValue: false,
      chartColors: CHART_PALETTE,
      dataLabelColor: DARK,
    }
  );
  footer(slide, opts.page, opts.total, opts.client);
}

function kpiDashboardSlide(
  pptx: PptxDeckCharts,
  charts: WprChartPack,
  opts: { client?: string; page: number; total: number }
) {
  const slide = pptx.addSlide();
  slideHeader(slide, pptx, "Project dashboard · KPI summary", opts.client);
  slide.addText(`Reporting window: ${charts.rangeStart} → ${charts.rangeEnd}`, {
    x: MARGIN,
    y: 1.05,
    w: CONTENT_W,
    h: 0.28,
    fontSize: 10,
    color: MUTED,
  });

  const kpis = charts.dashboardKpis.slice(0, 9);
  const cols = 3;
  const cardW = 4.0;
  const cardH = 1.55;
  const gapX = 0.2;
  const gapY = 0.18;
  const startX = MARGIN;
  const startY = 1.45;

  kpis.forEach(([label, value], i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w: cardW,
      h: cardH,
      fill: { color: LIGHT },
      line: { color: NAVY_XL, width: 0.75 },
    });
    slide.addText(String(label), {
      x: x + 0.18,
      y: y + 0.22,
      w: cardW - 0.36,
      h: 0.38,
      fontSize: 11,
      color: MUTED,
    });
    slide.addText(String(value), {
      x: x + 0.18,
      y: y + 0.68,
      w: cardW - 0.36,
      h: 0.55,
      fontSize: 22,
      bold: true,
      color: NAVY,
    });
  });

  footer(slide, opts.page, opts.total, opts.client);
}

function safetyChartSlide(
  pptx: PptxDeckCharts,
  charts: WprChartPack,
  opts: { client?: string; page: number; total: number }
) {
  const rows = charts.safety.filter((s) => s.previous > 0 || s.current > 0);
  const bars: WprBarPoint[] = (rows.length ? rows : charts.safety).map((s) => ({
    label: s.label,
    planned: s.previous,
    actual: s.current,
  }));
  barChartSlide(pptx, {
    title: "HSE Statistic · previous vs current week",
    subtitle: "Safe manhours, TBT, induction, trainings — PW vs CW from the week sheet",
    bars,
    valAxisTitle: "Count",
    client: opts.client,
    page: opts.page,
    total: opts.total,
  });
}

export function renderWprChartSlide(
  pptx: PptxDeckCharts,
  key: WprChartSlideKey,
  charts: WprChartPack,
  meta: { client?: string; page: number; total: number }
): void {
  switch (key) {
    case "dashboardKpis":
      kpiDashboardSlide(pptx, charts, meta);
      break;
    case "scurve":
      lineChartSlide(pptx, {
        title: "Project S-curve · planned vs actual %",
        subtitle: "Rollup from published DPRs in the reporting window",
        points: charts.scurve,
        ...meta,
      });
      break;
    case "milestones":
      barChartSlide(pptx, {
        title: "Project milestone schedule",
        subtitle: "Plan vs actual days — edit data labels in PowerPoint",
        bars: charts.milestones,
        valAxisTitle: "Days",
        ...meta,
      });
      break;
    case "manpower":
      barChartSlide(pptx, {
        title: "Weekly manpower histogram",
        subtitle: "Required vs available / daily headcount",
        bars: charts.manpowerHistogram,
        valAxisTitle: "Workers",
        ...meta,
      });
      break;
    case "cashflow":
      barChartSlide(pptx, {
        title: "Project cashflow overview",
        subtitle: "Planned vs actual (₹ lakh) by period",
        bars: charts.cashflow,
        valAxisTitle: "₹ lakh",
        ...meta,
      });
      break;
    case "drawingDci":
      pieChartSlide(pptx, {
        title: "Drawing register · DCI by discipline",
        subtitle: "Share of registered drawings per discipline",
        slices: charts.drawingDci,
        ...meta,
      });
      break;
    case "plannedVsActual":
      barChartSlide(pptx, {
        title: "Weekly planned vs actual quantities",
        subtitle: "Activity-level progress for the reporting week",
        bars: charts.plannedVsActual,
        valAxisTitle: "Qty",
        ...meta,
      });
      break;
    case "quality":
      pieChartSlide(pptx, {
        title: "Quality Statistic",
        subtitle: "Site Observation / Instruction / NCR — totals from the week sheet",
        slices: charts.quality,
        ...meta,
      });
      break;
    case "safety":
      safetyChartSlide(pptx, charts, meta);
      break;
    default:
      break;
  }
}
