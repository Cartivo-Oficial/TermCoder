import type { ComponentPropsWithoutRef, ElementType } from "react";

type RowTag = "div" | "button" | "a";

export function Row<T extends RowTag = "div">({
  as,
  active = false,
  className = "",
  ...rest
}: { as?: T; active?: boolean } & Omit<ComponentPropsWithoutRef<T>, "as">) {
  const Tag = (as ?? "div") as ElementType;
  return <Tag className={`u-row ${active ? "is-active" : ""} ${className}`.trim()} {...rest} />;
}
