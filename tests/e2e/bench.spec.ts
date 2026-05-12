import { expect, test } from '@playwright/test';

test('the benchmark page measures queries over millions of rows', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/bench');
  await page.getByRole('button', { name: 'Run benchmark' }).click();

  const report = page.getByTestId('bench-report');
  await expect(report).toBeVisible({ timeout: 150_000 });
  await expect(report).toContainText('Query over 2,869,937 rows');
  await expect(report.locator('tbody tr')).toHaveCount(8);
  await expect(report).toContainText('1,000,000 rows');

  const markdown = await page.getByLabel('Benchmark results as Markdown').inputValue();
  expect(markdown).toMatch(/^Measured on .+, \d{4}-\d{2}-\d{2}, DuckDB v\d/);
  expect(markdown).toMatch(/\| Count all rows \| [\d.]+ ms \| [\d.]+ ms \|/);
  console.log(`\n${markdown}\n`);
});

test('the landing page links to the benchmark and back', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Run the benchmark/ }).click();
  await expect(page.getByRole('heading', { name: 'Benchmark' })).toBeVisible();
  await page.getByRole('link', { name: /Back to/ }).click();
  await expect(page.getByRole('heading', { name: /Query millions of rows/ })).toBeVisible();
});
