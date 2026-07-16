import type { ComponentType } from "react";
import Home from "@/pages/home";
import Changelog from "@/pages/changelog";
import Install from "@/pages/install";
import Download from "@/pages/download";
import Features from "@/pages/features";
import Study from "@/pages/study";
import Pricing from "@/pages/pricing";
import Docs from "@/pages/docs";
import Viewer from "@/pages/viewer";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";

export interface RouteDef {
  path: string;
  title: string;
  description: string;
  Component: ComponentType;
  /** classic scripts to load on this page only, resolved relative to it */
  scripts?: string[];
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
    path: "/features.html",
    title: "TermCoder — features",
    description:
      "Everything the TermCoder builder does: no API key, twelve providers, sub-agents with real permissions, checkpoints, sync and packs, MCP and language servers.",
    Component: Features,
  },
  {
    path: "/study.html",
    title: "TermCoder — a tutor is built in",
    description:
      "TermExplorer turns TermCoder into a patient tutor: explanations step by step, flashcards on a real SM-2 scheduler, a streak, classrooms and live rooms. Free for students.",
    Component: Study,
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
    path: "/docs.html",
    title: "Documentation — TermCoder",
    description:
      "Complete documentation for TermCoder: install, first run, commands, models and providers, modes, agents, skills, study mode, configuration, keyboard shortcuts, and troubleshooting.",
    Component: Docs,
  },
  {
    path: "/pricing.html",
    title: "TermCoder — pricing",
    description:
      "The agent, the tutor and the source are free forever. Pro is $9/month for the person who hosts a room or teaches a class — joining is always free.",
    Component: Pricing,
  },
  {
    path: "/login.html",
    title: "TermCoder — sign in",
    description:
      "Sign in to your TermCoder dashboard with GitHub or Google. Optional — TermCoder runs with no account and no API key.",
    Component: Login,
    // The OAuth redirect flow lives in these two files and is deliberately not
    // ported: callback.html loads the same pair, and auth.js derives its
    // redirect_uri from the page URL, so both must stay put.
    scripts: ["config.js?v=3", "auth.js?v=6"],
  },
  {
    path: "/dashboard.html",
    title: "TermCoder — dashboard",
    description:
      "Your TermCoder dashboard — models, synced sessions, recipes, MCP connectors, and study decks in one place.",
    Component: Dashboard,
  },
  {
    path: "/viewer.html",
    title: "Session viewer — TermCoder",
    description: "Open a shared TermCoder session from a link — a read-only transcript, no install.",
    Component: Viewer,
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
