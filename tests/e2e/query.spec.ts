import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.join(import.meta.dirname, '..', 'fixtures', name);

async function runSql(page: Page, sql: string) {
  const editor = page.locator('.cm-content');
  await editor.fill(sql);
  await editor.press('ControlOrMeta+Enter');
}

const cells = (page: Page, row: number) =>
  page.getByTestId('result-table').locator('tbody tr').nth(row).locator('td');

test('previews the first loaded file automatically', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(fixture('orders.csv'));
  await expect(page.locator('.cm-content')).toContainText('SELECT * FROM orders LIMIT 100;');
  await expect(page.getByTestId('result-summary')).toContainText('5 rows');
  await expect(cells(page, 0)).toHaveText(['1', '10', '25.5', '2025-01-03']);
});

test('joins across two files', async ({ page }) => {
  await page.goto('/');
  await page
    .getByTestId('file-input')
    .setInputFiles([fixture('orders.csv'), fixture('customers.json')]);
  await expect(page.getByTestId('table-item')).toHaveCount(2);

  await runSql(
    page,
    `SELECT c.name, count(*) AS orders, sum(o.amount) AS total
     FROM orders o JOIN customers c USING (customer_id)
     GROUP BY c.name ORDER BY total DESC`,
  );
  await expect(page.getByTestId('result-summary')).toContainText('3 rows');
  await expect(cells(page, 0)).toHaveText(['Grace', '2', '105.75']);
  await expect(cells(page, 1)).toHaveText(['Linus', '1', '60']);
  await expect(cells(page, 2)).toHaveText(['Ada', '2', '39.75']);
});

test('formats every common value type readably', async ({ page }) => {
  await page.goto('/');
  await runSql(
    page,
    `SELECT -1.50::DECIMAL(10,2) AS dec, DATE '2025-01-03' AS d,
            TIMESTAMP '2025-01-03 04:05:06' AS ts, 9007199254740993::BIGINT AS big,
            NULL AS nothing, [1, 2] AS list, {'a': 1, 'b': 'x'} AS struct,
            1.5::DOUBLE AS dbl, true AS flag, sum(x) AS huge
     FROM (VALUES (1), (2)) t(x)`,
  );
  await expect(cells(page, 0)).toHaveText([
    '-1.50',
    '2025-01-03',
    '2025-01-03 04:05:06',
    '9007199254740993',
    'NULL',
    '[1,2]',
    '{"a":1,"b":"x"}',
    '1.5',
    'true',
    '3',
  ]);
});

test('shows SQL errors and recovers', async ({ page }) => {
  await page.goto('/');
  await runSql(page, 'SELEC 1');
  await expect(page.getByTestId('query-error')).toContainText('syntax error');
  await runSql(page, 'SELECT 42 AS answer');
  await expect(cells(page, 0)).toHaveText(['42']);
  await expect(page.getByTestId('query-error')).toHaveCount(0);
});

test('tables created by queries appear in the sidebar', async ({ page }) => {
  await page.goto('/');
  await runSql(page, 'CREATE TABLE squares AS SELECT i, i * i AS sq FROM range(10) t(i)');
  const item = page.getByTestId('table-item');
  await expect(item).toContainText('squares');
  await expect(item).toContainText('10 rows · 2 columns');
  await runSql(page, 'DROP TABLE squares');
  await expect(item).toHaveCount(0);
});

test('autocompletes table and column names', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(fixture('orders.csv'));
  await expect(page.getByTestId('table-item')).toHaveCount(1);

  const editor = page.locator('.cm-content');
  await editor.fill('');
  await editor.pressSequentially('SELECT ordered');
  await expect(page.locator('.cm-tooltip-autocomplete')).toContainText('ordered_at');
  await editor.fill('');
  await editor.pressSequentially('SELECT * FROM ord');
  await expect(page.locator('.cm-tooltip-autocomplete')).toContainText('orders');
});

test('caps very large results', async ({ page }) => {
  await page.goto('/');
  await runSql(page, 'SELECT i FROM range(250000) t(i)');
  await expect(page.getByTestId('result-summary')).toContainText('First 100,000 rows');
});
