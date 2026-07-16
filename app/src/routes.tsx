import type { ComponentType } from "react";
import Home from "@/pages/home";
import Changelog from "@/pages/changelog";

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
