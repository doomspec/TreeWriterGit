import { defineConfig, devices } from "@playwright/test";

/** Layout audit against an already-running TreeWriterGit dev server (see TREEWRITER_LAYOUT_BASE). */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: process.env.TREEWRITER_LAYOUT_BASE ?? "http://127.0.0.1:5174",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
