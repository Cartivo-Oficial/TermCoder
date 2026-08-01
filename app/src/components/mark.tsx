import markUrl from "@/assets/mark.png";

export function Mark({ size = 22 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        display: "inline-block",
        flex: "none",
        background: "currentColor",
        WebkitMaskImage: `url(${markUrl})`,
        maskImage: `url(${markUrl})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
      }}
    />
  );
}
