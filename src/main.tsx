import React from "react";
import ReactDOM from "react-dom/client";
import { generateLibrary } from "./services/synthetic";
import { App } from "./ui/App";
import "./ui/styles.css";

// Dev only: `?seed=2000` replaces the stored library with N synthetic movies (perf testing, screenshots).
if (import.meta.env.DEV) {
  const seed = Number(new URLSearchParams(location.search).get("seed"));
  if (seed > 0) window.localStorage.setItem("leffasto.library.v2", JSON.stringify(generateLibrary(seed)));
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App storage={window.localStorage} />
  </React.StrictMode>,
);
