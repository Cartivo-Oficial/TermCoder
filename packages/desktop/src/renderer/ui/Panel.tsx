import type { HTMLAttributes, ReactNode } from "react";

export function Panel({
  head,
  elevation = "flat",
  className = "",
  children,
  ...rest
}: { head?: ReactNode; elevation?: "flat" | "raised" } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`u-panel u-panel-${elevation} ${className}`.trim()} {...rest}>
      {head !== undefined && <div className="u-panel-head">{head}</div>}
      <div className="u-panel-body">{children}</div>
    </div>
  );
}
