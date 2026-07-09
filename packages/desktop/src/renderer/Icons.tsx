import type { SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </svg>
);

export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconNewChat = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
    <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L13 14l-4 1 1-4Z" />
  </svg>
);

export const IconSend = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

export const IconChevron = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} width={14} height={14} {...p}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const IconFolder = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} width={14} height={14} {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </svg>
);

export const IconFile = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} width={14} height={14} {...p}>
    <path d="M14 3v5h5" />
    <path d="M6 3h8l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
  </svg>
);

export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconBack = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export const IconForward = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export const IconMinimize = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} width={14} height={14} {...p}>
    <path d="M5 12h14" />
  </svg>
);

export const IconMaximize = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} width={13} height={13} {...p}>
    <rect x="5" y="5" width="14" height="14" rx="1.5" />
  </svg>
);

export const IconSun = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const IconMoon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
);

export const IconGear = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
);

export const IconMenu = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const IconUndo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} width={15} height={15} {...p}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h11a5 5 0 0 1 0 10h-1" />
  </svg>
);

export const IconMic = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
  </svg>
);

export const IconStop = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none" />
  </svg>
);

export const IconShare = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} width={15} height={15} {...p}>
    <circle cx="18" cy="5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
  </svg>
);

export const IconCopy = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} width={14} height={14} {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </svg>
);

export const IconEdit = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} width={14} height={14} {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

export const IconTrash = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} width={14} height={14} {...p}>
    <path d="M4 7h16" />
    <path d="M10 11v6M14 11v6" />
    <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
  </svg>
);

export const IconServer = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <rect x="3" y="4" width="18" height="7" rx="2" />
    <rect x="3" y="13" width="18" height="7" rx="2" />
    <path d="M7 7.5h.01M7 16.5h.01" />
  </svg>
);

export const IconBolt = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M13 2 4.5 13.5a.6.6 0 0 0 .5 1h5l-1 7.5L19.5 10a.6.6 0 0 0-.5-1h-5l1-6z" />
  </svg>
);

export const IconStudy = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M22 9.5 12 5 2 9.5l10 4.5 10-4.5z" />
    <path d="M6 11.5v4.2c0 1 2.7 2.3 6 2.3s6-1.3 6-2.3v-4.2" />
    <path d="M22 9.5v5" />
  </svg>
);

export const IconChat = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

export const IconAgents = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <rect x="5" y="7" width="14" height="12" rx="2" />
    <path d="M12 7V4M8 12h.01M16 12h.01M9 16h6" />
  </svg>
);

