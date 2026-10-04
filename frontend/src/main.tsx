import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4";
import "./design/tokens.css";
import "./design/global.css";
import { App } from "./App";
import { warmUp } from "./api/client";

warmUp(); // start waking a sleeping backend as early as possible

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
