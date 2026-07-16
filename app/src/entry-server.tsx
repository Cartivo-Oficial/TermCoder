import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { matchRoute, ROUTES } from "@/routes";
import "./index.css";

export function render(pathname: string) {
  const route = matchRoute(pathname);
  const { Component } = route;
  const html = renderToString(
    <StrictMode>
      <Component />
    </StrictMode>,
  );
  return { html, title: route.title, description: route.description };
}

export const routes = ROUTES.map((r) => ({ path: r.path, scripts: r.scripts ?? [] }));
