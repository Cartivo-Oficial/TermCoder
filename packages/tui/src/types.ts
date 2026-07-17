export type ViewItem =
  | { kind: "user"; text: string; time?: string }
  | { kind: "assistant"; text: string; time?: string; dur?: string }
  | {
      kind: "tool";
      id: string;
      name: string;
      title?: string;
      detail?: string;
      status: "running" | "done" | "error";
      output?: string;
    }
  | { kind: "notice"; text: string }
  | { kind: "error"; text: string }
  | { kind: "thinking"; text: string; done?: boolean; dur?: string };
