import type { HTMLAttributes } from "react";

export function Row({
  active = false,
  className = "",
  ...rest
}: { active?: boolean } & HTMLAttributes<HTMLDivElement>) {
  return <div className={`u-row ${active ? "is-active" : ""} ${className}`.trim()} {...rest} />;
}
