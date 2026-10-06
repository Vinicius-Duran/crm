import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// O E2E grava no Supabase de verdade: lê as mesmas variáveis do `next dev`.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  testDir: "e2e",
  // 60 s não cobre o fluxo completo em execução fria: o perfil desktop roda primeiro, contra um
  // `next dev` ainda frio, que compila cada rota no primeiro acesso, e levou de 57 s a 65 s em três
  // execuções frias medidas (issue #31, ver "Decisões tomadas" no IMPLEMENTACAO.md). 150 s dá folga
  // confortável sobre o pior caso.
  timeout: 150_000,
  // O `next dev` compila cada rota no primeiro acesso; 5 s (o padrão) não cobre a primeira gravação.
  expect: { timeout: 15_000 },
  workers: 1,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
  webServer: { command: "npm run dev", url: "http://localhost:3000/eventos", reuseExistingServer: true, timeout: 120_000 },
});
