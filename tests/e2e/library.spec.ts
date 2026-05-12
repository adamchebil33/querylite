import { expect, test, type Page } from '@playwright/test';

async function runSql(page: Page, sql: string) {
  const editor = page.locator('.cm-content');
  await editor.fill(sql);
  await editor.press('ControlOrMeta+Enter');
  await expect(page.getByTestId('result-summary').or(page.getByTestId('query-error'))).toBeVisible();
}

test('keeps query history and saved queries across reloads', async ({ page }) => {
  await page.goto('/app');
  await runSql(page, 'SELECT 1 AS one');
  await runSql(page, 'SELEC oops');
  await runSql(page, 'SELECT 2 AS two');

  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByLabel('Name for the saved query').fill('My query');
  await page.getByLabel('Name for the saved query').press('Enter');

  await page.reload();
  await page.getByRole('tab', { name: 'Queries' }).click();
  const history = page.getByTestId('query-history').getByRole('button');
  await expect(history).toHaveCount(3);
  await expect(history.nth(0)).toContainText('SELECT 2 AS two');
  await expect(history.nth(1)).toContainText('failed');

  // Clicking an entry puts it back in the editor.
  await history.nth(2).click();
  await expect(page.locator('.cm-content')).toHaveText('SELECT 1 AS one');
  await page.getByTestId('saved-queries').getByRole('button', { name: /^My query/ }).click();
  await expect(page.locator('.cm-content')).toHaveText('SELECT 2 AS two');

  await page.getByRole('button', { name: 'Delete saved query My query' }).click();
  await expect(page.getByTestId('saved-queries')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByTestId('query-history')).toHaveCount(0);
});

test('a share link reopens the query on its sample dataset', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.getByTestId('sample-emissions').click();
  await expect(page.getByTestId('result-summary')).toBeVisible({ timeout: 45_000 });
  await runSql(page, "SELECT country, year FROM emissions WHERE country = 'France' AND year = 2000");

  await page.getByRole('button', { name: 'Share' }).click();
  await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const fragment = new URLSearchParams(new URL(link).hash.slice(1));
  // The link holds the sample's name and the SQL, and nothing else.
  expect([...fragment.keys()].sort()).toEqual(['data', 'sql']);
  expect(fragment.get('data')).toBe('emissions');
  expect(new URL(link).pathname).toBe('/app');

  const visitor = await context.newPage();
  await visitor.goto(link);
  await expect(visitor.getByTestId('result-summary')).toContainText('1 row', { timeout: 45_000 });
  await expect(visitor.getByTestId('result-table').getByRole('cell').first()).toHaveText('France');
  await expect(visitor.locator('.cm-content')).toContainText("WHERE country = 'France'");
});

test('a share link for private tables shows the SQL without running it', async ({ page }) => {
  await page.goto('/#sql=SELECT+*+FROM+my_private_table');
  await expect(page.locator('.cm-content')).toHaveText('SELECT * FROM my_private_table');
  await expect(page.getByTestId('engine-status')).toContainText('Engine ready');
  await expect(page.getByTestId('query-error')).toHaveCount(0);
  await expect(page.getByTestId('result-summary')).toHaveCount(0);
});

test('dark mode can be toggled and is remembered', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/app');
  const html = page.locator('html');
  await expect(html).not.toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(html).toHaveClass(/dark/);
  await page.reload();
  await expect(html).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(html).not.toHaveClass(/dark/);
});

test('follows the system color scheme by default', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/app');
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('the privacy badge explains the design', async ({ page }) => {
  await page.goto('/app');
  await page.getByRole('button', { name: 'Nothing is uploaded' }).click();
  const dialog = page.getByRole('dialog', { name: 'How your data stays private' });
  await expect(dialog).toContainText('never sent to a server');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
