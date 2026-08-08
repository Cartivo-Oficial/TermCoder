import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type PanelTag = "div" | "button";

export function Panel<T extends PanelTag = "div">({
  as,
  head,
  elevation = "flat",
  selected = false,
  className = "",
  children,
  ...rest
}: { as?: T; head?: ReactNode; elevation?: "flat" | "raised"; selected?: boolean } & Omit<
  ComponentPropsWithoutRef<T>,
  "as"
>) {
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag
      className={`u-panel u-panel-${elevation} ${selected ? "is-selected" : ""} ${className}`.trim()}
      {...rest}
    >
      {head !== undefined && <div className="u-panel-head">{head}</div>}
      <div className="u-panel-body">{children}</div>
    </Tag>
  );
}
