import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Production builds ship a strict Content Security Policy. The app makes no
// network requests at all, so connect-src is 'none', which blocks fetch, XHR,
// WebSockets and beacons. This is defense in depth, not a guarantee: CSP
// cannot block top-level navigation, so script that somehow ran in the page
// could still leak data that way. The primary control is script-src 'self'
// plus a ban on raw HTML and eval. Dev is exempt because Vite's HMR needs a
// websocket and inline scripts.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function contentSecurityPolicy(): Plugin {
  return {
    name: "fwc-csp",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        "<head>",
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  build: { sourcemap: false },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/test-setup.ts"],
  },
});
