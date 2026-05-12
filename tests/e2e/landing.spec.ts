import { expect, test } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.join(import.meta.dirname, '..', 'fixtures', name);

test('the landing page leads into the editor', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Query millions of rows/ })).toBeVisible();
  // The landing page is not the editor.
  await expect(page.getByTestId('sql-editor')).toHaveCount(0);

  await page.getByRole('button', { name: 'Open the editor' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByTestId('sql-editor')).toBeVisible();

  // The wordmark and the browser's back button both return to the landing page.
  await page.getByRole('link', { name: 'querylite' }).click();
  await expect(page.getByRole('heading', { name: /Query millions of rows/ })).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('sql-editor')).toBeVisible();
});

test('the main call to action loads the taxi sample in the editor', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Try it on 2.9 million taxi trips/ }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByTestId('result-summary')).toContainText('over 2,869,937 rows', {
    timeout: 45_000,
  });
});

test('files chosen on the landing page open in the editor', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('landing-file-input').setInputFiles(fixture('orders.csv'));
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByTestId('table-item')).toContainText('5 rows · 4 columns');
});

test('data survives a trip back to the landing page', async ({ page }) => {
  await page.goto('/app');
  await page.getByTestId('file-input').setInputFiles(fixture('orders.csv'));
  await expect(page.getByTestId('table-item')).toHaveCount(1);
  await page.getByRole('link', { name: 'querylite' }).click();
  await page.getByRole('button', { name: 'Open the editor' }).click();
  await expect(page.getByTestId('table-item')).toContainText('5 rows · 4 columns');
});

test('the empty editor is uncluttered', async ({ page }) => {
  await page.goto('/app');
  await expect(page.getByText('No data yet.')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Query millions of rows/ })).toHaveCount(0);
});
