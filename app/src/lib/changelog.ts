import raw from "../../../CHANGELOG.md?raw";

export interface Area {
  name: string;
  items: string[];
}

export interface Release {
  version: string;
  date: string;
  intro?: string;
  areas: Area[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseChangelog(md: string): Release[] {
  return md
    .split(/^## +/m)
    .slice(1)
    .map((part) => {
      const lines = part.split("\n");
      const version = (lines.shift() ?? "").trim();
      let date = "";
      const introLines: string[] = [];
      const areas: Area[] = [];
      let current: Area | null = null;

      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        if (!date && DATE.test(t)) {
          date = t;
          continue;
        }
        if (t.startsWith("### ")) {
          current = { name: t.slice(4).trim(), items: [] };
          areas.push(current);
          continue;
        }
        if (t.startsWith("- ")) {
          if (current) current.items.push(t.slice(2).trim());
          continue;
        }
        if (!current) introLines.push(t);
      }

      const intro = introLines.join(" ").trim();
      return intro ? { version, date, intro, areas } : { version, date, areas };
    });
}

/** Escape first, then apply the small subset of markdown the changelog uses. */
export function inlineMd(md: string): string {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/`([^`]+)`/g, '<code class="rounded bg-white/6 px-1 py-0.5 font-mono text-[0.9em] text-foreground">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-normal text-foreground">$1</strong>')
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export const RELEASES: Release[] = parseChangelog(raw);
