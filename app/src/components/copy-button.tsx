"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      className="rounded-md border border-white/15 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
