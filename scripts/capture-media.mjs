// Captures the product screenshots used on the landing page and in the README.
// Start the app first (npm run dev), then run: npm run capture
//   node scripts/capture-media.mjs [base-url]
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:5173';
const outDir = path.join(import.meta.dirname, '..', 'public', 'media');
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
for (const scheme of ['light', 'dark']) {
  const page = await browser.newPage({
    viewport: { width: 1380, height: 820 },
    colorScheme: scheme,
    deviceScaleFactor: 1,
  });
  await page.goto(`${base}/app`);
  await page.getByRole('button', { name: 'Load sample NYC taxi trips' }).click();
  await page.getByTestId('result-summary').waitFor({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Top 10 pickup zones' }).click();
  await page.getByTestId('chart').locator('svg').waitFor();
  await page.waitForTimeout(800);
  // Park the pointer away from anything with a hover state.
  await page.mouse.move(700, 790);
  const file = path.join(outDir, `workspace-${scheme}.png`);
  await page.screenshot({ path: file });
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
  await page.close();
}
await browser.close();
