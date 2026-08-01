import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const BASE = "https://github.com/Cartivo-Oficial/TermCoder/releases/latest/download/";

type Os = "Windows" | "macOS" | "Linux";

const PRIMARY: Record<Os, string> = {
  Windows: "TermCoder-Setup.exe",
  macOS: "TermCoder-arm64.dmg",
  Linux: "TermCoder-x86_64.AppImage",
};

export function PrimaryDownload() {
  const [os, setOs] = useState<Os>("Windows");

  useEffect(() => {
    const p = navigator.platform || "";
    const mac = /Mac/i.test(p);
    const linux = /Linux/i.test(p) && !/Android/i.test(navigator.userAgent);
    setOs(mac ? "macOS" : linux ? "Linux" : "Windows");
  }, []);

  return (
    <div className="mt-8 flex flex-wrap items-center gap-4">
      <a
        href={BASE + PRIMARY[os]}
        className={cn(buttonVariants(), "h-12 rounded-lg px-6 font-mono text-[15px]")}
      >
        Download for {os} →
      </a>
      <span className="font-mono text-[12px] text-muted-foreground">{PRIMARY[os]} · latest release</span>
    </div>
  );
}
