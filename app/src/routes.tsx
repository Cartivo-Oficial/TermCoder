import type { ComponentType } from "react";
import Home from "@/pages/home";

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
];

export function matchRoute(pathname: string): RouteDef {
  const clean = pathname.replace(/^\/TermCoder\/preview/, "").replace(/\/$/, "") || "/index.html";
  const withHtml = clean.endsWith(".html") ? clean : `${clean}.html`;
  return ROUTES.find((r) => r.path === withHtml) ?? ROUTES[0];
}
