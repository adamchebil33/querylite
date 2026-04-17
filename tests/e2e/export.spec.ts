import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('exports the full result as CSV and Parquet', async ({ page }) => {
  await page.goto('/');
  const editor = page.locator('.cm-content');
  // More rows than the display limit, to prove the export is not cut off.
  await editor.fill('SELECT i AS id, i * 2 AS doubled FROM range(150000) t(i); -- trailing comment');
  await editor.press('ControlOrMeta+Enter');
  await expect(page.getByTestId('result-summary')).toContainText('First 100,000 rows');

  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV' }).click();
  const csv = await csvDownload;
  expect(csv.suggestedFilename()).toBe('querylite-result.csv');
  const lines = (await readFile(await csv.path(), 'utf8')).trim().split('\n');
  expect(lines).toHaveLength(150_001);
  expect(lines[0]).toBe('id,doubled');
  expect(lines[150_000]).toBe('149999,299998');

  const parquetDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Parquet' }).click();
  const parquet = await parquetDownload;
  expect(parquet.suggestedFilename()).toBe('querylite-result.parquet');
  const bytes = await readFile(await parquet.path());
  expect(bytes.subarray(0, 4).toString()).toBe('PAR1');
  expect(bytes.subarray(-4).toString()).toBe('PAR1');
});

test('explains when a statement cannot be exported', async ({ page }) => {
  await page.goto('/');
  const editor = page.locator('.cm-content');
  await editor.fill('CREATE TABLE t AS SELECT 1 AS x');
  await editor.press('ControlOrMeta+Enter');
  await expect(page.getByTestId('table-item')).toHaveCount(1);
  await page.getByRole('button', { name: 'CSV' }).click();
  await expect(page.getByRole('alert')).toContainText('Export failed');
});
