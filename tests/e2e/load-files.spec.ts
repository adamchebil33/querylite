import { expect, test } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.join(import.meta.dirname, '..', 'fixtures', name);

test('loads CSV, TSV and JSON files as tables', async ({ page }) => {
  await page.goto('/app');
  await page
    .getByTestId('file-input')
    .setInputFiles([fixture('orders.csv'), fixture('customers.json'), fixture('products.tsv')]);

  const tables = page.getByTestId('table-item');
  await expect(tables).toHaveCount(3);
  await expect(tables.nth(0)).toContainText('orders');
  await expect(tables.nth(0)).toContainText('5 rows · 4 columns');
  await expect(tables.nth(1)).toContainText('customers');
  await expect(tables.nth(1)).toContainText('3 rows · 3 columns');
  await expect(tables.nth(2)).toContainText('products');
  await expect(tables.nth(2)).toContainText('2 rows · 2 columns');
});

test('loads a Parquet file', async ({ page }) => {
  await page.goto('/app');
  await page.getByTestId('file-input').setInputFiles(fixture('zones.parquet'));
  await expect(page.getByTestId('table-item')).toContainText('8 rows · 3 columns');
});

test('loads an Excel file', async ({ page }) => {
  await page.goto('/app');
  await page.getByTestId('file-input').setInputFiles(fixture('sales.xlsx'));
  await expect(page.getByTestId('table-item')).toContainText('3 rows · 4 columns');
  const firstRow = page.getByTestId('result-table').locator('[aria-rowindex="2"]').getByRole('cell');
  await expect(firstRow).toHaveText(['Widget', '3', '9.99', '2025-01-05']);
});

test('loading the same file twice creates a second table', async ({ page }) => {
  await page.goto('/app');
  await page.getByTestId('file-input').setInputFiles(fixture('orders.csv'));
  await expect(page.getByTestId('table-item')).toHaveCount(1);
  await page.getByTestId('file-input').setInputFiles(fixture('orders.csv'));
  await expect(page.getByTestId('table-item').nth(1)).toContainText('orders_2');
});

test('rejects unsupported files with a clear message', async ({ page }) => {
  await page.goto('/app');
  await page.getByTestId('file-input').setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not a table'),
  });
  await expect(page.getByRole('alert')).toContainText('Unsupported file type');
});
