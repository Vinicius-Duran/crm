import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// O E2E grava no Supabase de verdade: lê as mesmas variáveis do `next dev`.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  workers: 1,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
  webServer: { command: "npm run dev", url: "http://localhost:3000/eventos", reuseExistingServer: true, timeout: 120_000 },
});
