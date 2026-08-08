import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

export function Chip({
  on = false,
  interactive = false,
  className = "",
  ...rest
}: { on?: boolean; interactive?: boolean } & ButtonHTMLAttributes<HTMLButtonElement> &
  HTMLAttributes<HTMLSpanElement>) {
  const cls = `u-chip ${on ? "is-on" : ""} ${className}`.trim();
  if (!interactive) return <span className={cls} {...(rest as HTMLAttributes<HTMLSpanElement>)} />;
  return <button className={cls} aria-pressed={on} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)} />;
}
