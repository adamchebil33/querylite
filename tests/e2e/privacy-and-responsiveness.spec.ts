import { expect, test } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.join(import.meta.dirname, '..', 'fixtures', name);

// Code may be downloaded from these hosts; user data must never be sent anywhere.
const CODE_HOSTS = ['cdn.jsdelivr.net', 'extensions.duckdb.org'];

test('only downloads code from known hosts and never uploads', async ({ page, baseURL }) => {
  const unexpected: string[] = [];
  const uploads: string[] = [];
  const allowed = new Set([...CODE_HOSTS, new URL(baseURL!).host]);
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol === 'blob:' || url.protocol === 'data:') return;
    if (!allowed.has(url.host)) unexpected.push(request.url());
    if (!['GET', 'HEAD'].includes(request.method()) || request.postData() !== null) {
      uploads.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.goto('/');
  await page
    .getByTestId('file-input')
    .setInputFiles([
      fixture('orders.csv'),
      fixture('customers.json'),
      fixture('products.tsv'),
      fixture('zones.parquet'),
    ]);
  await expect(page.getByTestId('table-item')).toHaveCount(4);

  expect(unexpected).toEqual([]);
  expect(uploads).toEqual([]);
});

test('the page stays responsive while a large file loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('engine-status')).toContainText('Engine ready');

  // Build a ~1M row CSV inside the page (so no large fixture lives in the repo),
  // then measure the longest gap between animation frames while it loads.
  await page.evaluate(async () => {
    const lines = ['id,category,value'];
    for (let i = 0; i < 1_000_000; i++) lines.push(`${i},cat_${i % 50},${(i * 7919) % 10007}`);
    const file = new File([lines.join('\n')], 'big.csv', { type: 'text/csv' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = document.querySelector<HTMLInputElement>('[data-testid="file-input"]')!;
    input.files = transfer.files;

    // Let the page settle after building the file before measuring.
    await new Promise((resolve) => setTimeout(resolve, 300));
    const w = window as unknown as { __maxGap: number };
    w.__maxGap = 0;
    let last = performance.now();
    const tick = (now: number) => {
      w.__maxGap = Math.max(w.__maxGap, now - last);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await expect(page.getByTestId('table-item')).toContainText('1,000,000 rows', { timeout: 45_000 });

  const maxGap = await page.evaluate(() => (window as unknown as { __maxGap: number }).__maxGap);
  console.log(`longest main-thread gap while loading 1M rows: ${Math.round(maxGap)} ms`);
  expect(maxGap).toBeLessThan(250);
});
