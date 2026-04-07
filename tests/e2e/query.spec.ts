import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.join(import.meta.dirname, '..', 'fixtures', name);

async function runSql(page: Page, sql: string) {
  const editor = page.locator('.cm-content');
  await editor.fill(sql);
  await editor.press('ControlOrMeta+Enter');
}

const cells = (page: Page, row: number) =>
  page.getByTestId('result-table').locator(`[aria-rowindex="${row + 2}"]`).getByRole('cell');

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

test('scrolls through 100,000 rows while rendering only the visible ones', async ({ page }) => {
  await page.goto('/');
  await runSql(page, 'SELECT i, i * 2 AS doubled FROM range(100000) t(i)');
  await expect(page.getByTestId('result-summary')).toContainText('100,000 rows');
  const table = page.getByTestId('result-table');
  expect(await table.getByRole('row').count()).toBeLessThan(100);

  await table.evaluate((el) => el.parentElement!.scrollTo(0, el.scrollHeight));
  await expect(cells(page, 99_999)).toHaveText(['99999', '199998']);
  expect(await table.getByRole('row').count()).toBeLessThan(100);
});

test('sorts by clicking a column header', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(fixture('orders.csv'));
  await expect(page.getByTestId('result-summary')).toContainText('5 rows');

  const amount = page.getByRole('button', { name: 'Sort by amount' });
  await amount.click();
  await expect(cells(page, 0)).toHaveText(['5', '11', '5.75', '2025-03-01']);
  await amount.click();
  await expect(cells(page, 0)).toHaveText(['2', '11', '100', '2025-01-04']);
  await amount.click();
  await expect(cells(page, 0)).toHaveText(['1', '10', '25.5', '2025-01-03']);
});

test('sorting a cut-off result sorts the full result in the database', async ({ page }) => {
  await page.goto('/');
  await runSql(page, 'SELECT i FROM range(250000) t(i);');
  await expect(page.getByTestId('result-summary')).toContainText('First 100,000 rows');
  await page.getByRole('button', { name: 'Sort by i' }).click();
  await page.getByRole('button', { name: 'Sort by i' }).click();
  // Descending: the largest value is beyond the first 100,000 rows.
  await expect(cells(page, 0)).toHaveText(['249999']);
});

test('reports how many rows a query read', async ({ page }) => {
  await page.goto('/');
  await page
    .getByTestId('file-input')
    .setInputFiles([fixture('orders.csv'), fixture('customers.json')]);
  await expect(page.getByTestId('table-item')).toHaveCount(2);
  await runSql(page, 'SELECT count(*) FROM orders JOIN customers USING (customer_id)');
  await expect(page.getByTestId('result-summary')).toContainText('1 row ·');
  await expect(page.getByTestId('result-summary')).toContainText('over 8 rows');
});

test('explains errors in plain parts', async ({ page }) => {
  await page.goto('/');
  await runSql(page, 'SELECT * FROM ordrs');
  const error = page.getByTestId('query-error');
  await expect(error).toContainText('Unknown table or function');
  await expect(error).toContainText('No tables are loaded yet');
  await expect(error).not.toContainText('pragma_database_list');
  await runSql(page, 'SELEC 1');
  await expect(error).toContainText('Syntax error');
  await expect(error).not.toContainText('exception_type');
});

test('cancels a long-running query', async ({ page }) => {
  await page.goto('/');
  await runSql(page, 'SELECT sum(i) FROM range(20000000000) t(i)');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Run' })).toBeVisible({ timeout: 10_000 });
  await runSql(page, 'SELECT 42 AS answer');
  await expect(cells(page, 0)).toHaveText(['42']);
});
