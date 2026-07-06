import React from "react";

type P = React.SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

export const IconSelect = (p: P) => (
  <svg {...base(p)}><path d="M5 3l6 16 2-7 7-2z" /></svg>
);
export const IconMass = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="6" /><path d="M9 12h6" /></svg>
);
export const IconSpring = (p: P) => (
  <svg {...base(p)}><path d="M3 12h2l1.5-4 3 8 3-8 3 8L18 8l1.5 4H21" /></svg>
);
export const IconGround = (p: P) => (
  <svg {...base(p)}><path d="M3 9h18" /><path d="M6 9v5M10 9v5M14 9v5M18 9v5" /><path d="M5 14l-1 3M9 14l-1 3M13 14l-1 3M17 14l-1 3" /></svg>
);
export const IconPoint = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="2.5" fill="currentColor" /></svg>
);
export const IconLine = (p: P) => (
  <svg {...base(p)}><path d="M4 20L20 4" strokeDasharray="3 3" /></svg>
);
export const IconText = (p: P) => (
  <svg {...base(p)}><path d="M5 5h14M12 5v14M9 19h6" /></svg>
);
export const IconPlay = (p: P) => (
  <svg {...base(p)}><path d="M7 4l13 8-13 8z" fill="currentColor" /></svg>
);
export const IconPause = (p: P) => (
  <svg {...base(p)}><rect x="6" y="4" width="4" height="16" fill="currentColor" /><rect x="14" y="4" width="4" height="16" fill="currentColor" /></svg>
);
export const IconReset = (p: P) => (
  <svg {...base(p)}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
);
export const IconStop = (p: P) => (
  <svg {...base(p)}><rect x="6" y="6" width="12" height="12" fill="currentColor" /></svg>
);
export const IconGrid = (p: P) => (
  <svg {...base(p)}><path d="M3 3h18v18H3z" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /></svg>
);
export const IconAxis = (p: P) => (
  <svg {...base(p)}><path d="M4 20V4M4 20h16" /><path d="M4 4l-2 2M4 4l2 2M20 20l-2-2M20 20l-2 2" /></svg>
);
export const IconChart = (p: P) => (
  <svg {...base(p)}><path d="M3 3v18h18" /><path d="M6 14l3-4 3 3 4-6" /></svg>
);
export const IconTrash = (p: P) => (
  <svg {...base(p)}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
);
export const IconPlus = (p: P) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconBook = (p: P) => (
  <svg {...base(p)}><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z" /><path d="M4 19a2 2 0 012-2h13" /></svg>
);
export const IconUser = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" /></svg>
);
export const IconExperiment = (p: P) => (
  <svg {...base(p)}><path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3" /><path d="M7 16h10" /></svg>
);
export const IconClose = (p: P) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconArrowRight = (p: P) => (
  <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconChevronDown = (p: P) => (
  <svg {...base(p)}><path d="M6 9l6 6 6-6" /></svg>
);
export const IconWrench = (p: P) => (
  <svg {...base(p)}><path d="M14 7a4 4 0 01-5 5L4 17v3h3l5-5a4 4 0 005-5l-3 3-2-2 2-3z" /></svg>
);
export const IconConveyor = (p: P) => (
  <svg {...base(p)}><path d="M3 12h18" /><path d="M6 12l2-3M11 12l2-3M16 12l2-3" /><path d="M6 12l2 3M11 12l2 3M16 12l2 3" /></svg>
);
export const IconTether = (p: P) => (
  <svg {...base(p)}><circle cx="6" cy="6" r="2" /><circle cx="18" cy="18" r="3" /><path d="M7.5 7.5L16 16" strokeDasharray="3 2" /></svg>
);
export const IconEField = (p: P) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="1" strokeDasharray="3 2" /><path d="M7 12h8M13 9l3 3-3 3" /></svg>
);
export const IconBField = (p: P) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="1" strokeDasharray="3 2" /><circle cx="9" cy="12" r="2.5" /><circle cx="9" cy="12" r="0.8" fill="currentColor" /><circle cx="16" cy="12" r="2.5" /><path d="M15 11l2 2M17 11l-2 2" /></svg>
);
export const IconSource = (p: P) => (
  <svg {...base(p)}><circle cx="8" cy="12" r="3" /><circle cx="8" cy="12" r="5" strokeDasharray="2 2" /><path d="M11 12h7M15 9l3 3-3 3" /></svg>
);
export const IconSave = (p: P) => (
  <svg {...base(p)}><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v5h7M8 21v-7h8v7" /></svg>
);
export const IconFolder = (p: P) => (
  <svg {...base(p)}><path d="M3 6h6l2 2h10v12H3z" /></svg>
);
export const IconDownload = (p: P) => (
  <svg {...base(p)}><path d="M12 3v12M8 11l4 4 4-4M5 19h14" /></svg>
);
