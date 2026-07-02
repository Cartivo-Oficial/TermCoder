import type { SVGProps } from "react";

/** The termcoder mark: a bold squared-"C" bracket with an inset card. */
export const Logo = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 96 96" width={18} height={18} {...p}>
    <path
      fill="currentColor"
      d="M29.25 25.5 L68.25 27 L61.3 35.4 L39.4 34.3 L39.4 61.5 L61.3 60.6 L68.25 69 L29.25 70.5 Z"
    />
    <rect x="53.1" y="37.9" width="15.4" height="28.1" rx="2.6" fill="#8f8f95" />
  </svg>
);
