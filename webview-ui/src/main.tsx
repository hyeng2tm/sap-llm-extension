import React from "react";
import ReactDOM from "react-dom/client";
import "@vscode/webview-ui-toolkit/dist/toolkit.js";
import {
  provideVSCodeDesignSystem,
  vsCodeButton,
  vsCodeTextArea
} from "@vscode/webview-ui-toolkit";
import App from "./App";

if (!customElements.get("vscode-button") || !customElements.get("vscode-text-area")) {
  provideVSCodeDesignSystem().register(vsCodeButton(), vsCodeTextArea());
}

ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);