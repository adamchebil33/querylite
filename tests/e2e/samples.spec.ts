import { expect, test, type Page } from '@playwright/test';

const cells = (page: Page, row: number) =>
  page.getByTestId('result-table').locator(`[aria-rowindex="${row + 2}"]`).getByRole('cell');

test('try a sample dataset: one click to a result over millions of rows', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('sample-taxi').click();

  // Both tables load and the first example question runs by itself.
  await expect(page.getByTestId('table-item')).toHaveCount(2, { timeout: 45_000 });
  await expect(page.getByTestId('table-item').first()).toContainText('2,869,937 rows');
  await expect(page.getByTestId('result-summary')).toContainText('24 rows');
  await expect(page.getByTestId('result-summary')).toContainText('over 2,869,937 rows');

  // An example chip that joins the two tables.
  await page.getByRole('button', { name: 'Top 10 pickup zones' }).click();
  await expect(page.getByTestId('result-summary')).toContainText('10 rows');
  await expect(cells(page, 0).nth(1)).toHaveText('Manhattan');
});

test('every example question of every sample runs', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Load sample NYC taxi trips' }).click();
  await page.getByRole('button', { name: 'Load sample World CO₂ emissions' }).click();
  await expect(page.getByTestId('table-item')).toHaveCount(3, { timeout: 45_000 });

  const chips = page.getByTestId('example-chips').getByRole('button');
  const count = await chips.count();
  expect(count).toBeGreaterThanOrEqual(8);
  for (let i = 0; i < count; i++) {
    await chips.nth(i).click();
    await expect(page.getByTestId('result-summary')).toBeVisible();
    await expect(page.getByTestId('query-error')).toHaveCount(0);
    await expect(page.getByTestId('result-table').getByRole('cell').first()).toBeVisible();
  }
});
