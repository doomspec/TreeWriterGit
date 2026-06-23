import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { CommandPaletteProvider } from "./lib/CommandPaletteProvider";
import { ReadingFocusProvider } from "./lib/readingFocus";
import { ReadingTypographyProvider } from "./lib/ReadingTypographyProvider";
import "./index.css";
import "@xterm/xterm/css/xterm.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CommandPaletteProvider>
      <ReadingTypographyProvider>
        <ReadingFocusProvider>
          <App />
        </ReadingFocusProvider>
      </ReadingTypographyProvider>
    </CommandPaletteProvider>
  </React.StrictMode>
);

