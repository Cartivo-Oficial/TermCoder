import type { ButtonHTMLAttributes } from "react";

// Presentational only. Every handler, label and aria-* passes straight through
// — a swept surface keeps its behaviour and changes only what it renders into.
export function Btn({
  size = "md",
  tone = "quiet",
  className = "",
  ...rest
}: { size?: "sm" | "md"; tone?: "quiet" | "solid" | "danger" } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`u-btn u-btn-${size} u-btn-${tone} ${className}`.trim()} {...rest} />;
}
