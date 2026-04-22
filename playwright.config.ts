import { defineConfig } from '@playwright/test';

// E2E_PREVIEW=1 runs the tests against the production build (with its
// security headers) instead of the dev server.
const preview = Boolean(process.env.E2E_PREVIEW);
const port = preview ? 4173 : 5173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  // The dev server can reload once while it pre-bundles dependencies on a cold start.
  retries: 1,
  use: { baseURL: `http://localhost:${port}` },
  webServer: {
    command: preview
      ? `npm run build && npm run preview -- --port ${port} --strictPort`
      : `npm run dev -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
