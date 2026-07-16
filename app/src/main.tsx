import { StrictMode } from "react";
import { hydrateRoot, createRoot } from "react-dom/client";
import { matchRoute } from "@/routes";
import "./index.css";

const { Component } = matchRoute(window.location.pathname);
const root = document.getElementById("root")!;
const tree = (
  <StrictMode>
    <Component />
  </StrictMode>
);

if (root.hasChildNodes()) hydrateRoot(root, tree);
else createRoot(root).render(tree);
