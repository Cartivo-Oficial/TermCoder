import type { ButtonHTMLAttributes } from "react";

export function Chip({
  on = false,
  className = "",
  ...rest
}: { on?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`u-chip ${on ? "is-on" : ""} ${className}`.trim()} aria-pressed={on} {...rest} />;
}
