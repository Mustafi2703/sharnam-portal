/** Shared SVG icon set — one design language for nav + modules */
import type { ReactNode } from "react";

type IconProps = { className?: string; size?: number };

function Svg({ size = 20, className = "", children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconDashboard(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Svg>
  );
}

export function IconModules(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </Svg>
  );
}

export function IconMaster(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
    </Svg>
  );
}

export function IconHome(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 10.5L12 4l8 6.5" />
      <path d="M6.5 9.5V20h11V9.5" />
    </Svg>
  );
}

export function IconDrawings(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-5-6z" />
      <path d="M14 3v6h6" />
      <path d="M8 13h8M8 17h5" />
    </Svg>
  );
}

export function IconQuality(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </Svg>
  );
}

export function IconSafety(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" />
      <path d="M12 8v5M12 16h.01" />
    </Svg>
  );
}

export function IconProgress(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 16V10" />
      <path d="M12 16V7" />
      <path d="M16 16v-4" />
    </Svg>
  );
}

export function IconField(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 20h16" />
      <path d="M6 20V10l6-6 6 6v10" />
      <path d="M10 20v-5h4v5" />
    </Svg>
  );
}

export function IconComms(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H7l-4 3V11.5A8.5 8.5 0 1 1 21 11.5z" />
      <path d="M8 11h.01M12 11h.01M16 11h.01" />
    </Svg>
  );
}

export function IconCost(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5c.5-1 1.5-1.5 2.5-1.5s2 .6 2 1.75-1 1.75-2.5 2.25-2.5.9-2.5 2.25 1 1.75 2.5 1.75 2-.5 2.5-1.5" />
    </Svg>
  );
}

export function IconFinance(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </Svg>
  );
}

export function IconReports(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </Svg>
  );
}

export function IconMenu(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function IconClose(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function IconChevron(p: IconProps) {
  return (
    <Svg {...p} size={p.size ?? 16}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  );
}

export function IconSun(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  );
}

export function IconMoon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5z" />
    </Svg>
  );
}

export function IconPanel(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </Svg>
  );
}

export function IconPanelRight(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16" />
    </Svg>
  );
}

export type ModuleIconKey =
  | "home"
  | "drawings"
  | "quality"
  | "safety"
  | "progress"
  | "field"
  | "comms"
  | "cost"
  | "finance"
  | "reports"
  | "dashboard"
  | "modules"
  | "master";

const MAP: Record<ModuleIconKey, (p: IconProps) => ReactNode> = {
  home: IconHome,
  drawings: IconDrawings,
  quality: IconQuality,
  safety: IconSafety,
  progress: IconProgress,
  field: IconField,
  comms: IconComms,
  cost: IconCost,
  finance: IconFinance,
  reports: IconReports,
  dashboard: IconDashboard,
  modules: IconModules,
  master: IconMaster,
};

export function ModuleIcon({ name, className = "", size = 20 }: { name: ModuleIconKey; className?: string; size?: number }) {
  const Comp = MAP[name] || IconModules;
  return <Comp className={className} size={size} />;
}
