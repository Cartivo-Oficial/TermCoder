import type { ComponentType } from "react";
import Home from "@/pages/home";
import Changelog from "@/pages/changelog";
import Install from "@/pages/install";
import Download from "@/pages/download";

export interface RouteDef {
  path: string;
  title: string;
  description: string;
  Component: ComponentType;
}

export const ROUTES: RouteDef[] = [
  {
    path: "/index.html",
    title: "TermCoder — one terminal, two minds",
    description:
      "An open-source AI coding agent that lives in your terminal — and a tutor that teaches you. Runs with no API key. One engine, two minds.",
    Component: Home,
  },
  {
    path: "/install.html",
    title: "TermCoder — install",
    description:
      "Install TermCoder with one npm command on Windows, macOS or Linux. No account, no API key, no config file — it opens on a free model.",
    Component: Install,
  },
  {
    path: "/download.html",
    title: "TermCoder — download the desktop app",
    description:
      "Download the TermCoder desktop app for Windows, macOS or Linux. Chat, an editor and a real terminal in one window, with Node bundled.",
    Component: Download,
  },
  {
    path: "/changelog.html",
    title: "TermCoder — changelog",
    description:
      "Every TermCoder release, newest first: what changed in the engine, the CLI, the desktop app and the site.",
    Component: Changelog,
  },
];

export function matchRoute(pathname: string): RouteDef {
  const clean = pathname.replace(/^\/TermCoder\/preview/, "").replace(/\/$/, "") || "/index.html";
  const withHtml = clean.endsWith(".html") ? clean : `${clean}.html`;
  return ROUTES.find((r) => r.path === withHtml) ?? ROUTES[0];
}
