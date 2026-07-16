import markUrl from "@/assets/mark.png";

const BRAND = "linear-gradient(135deg,#ff7a45 0%,#ff9a5f 46%,#31d0b4 100%)";

export function Mark({ size = 22, gradient = BRAND }: { size?: number; gradient?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        display: "inline-block",
        flex: "none",
        background: gradient,
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
