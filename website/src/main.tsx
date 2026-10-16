import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// The legal pages are static files (public/privacy, public/delete-account). If a host rewrites
// every URL to the app, send those paths to the real page instead of the home page.
const legalPage = window.location.pathname.match(/^\/(privacy|terms|delete-account)\/?$/);
if (legalPage) {
  window.location.replace(`/${legalPage[1]}/index.html`);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
