import { expect, test } from '@playwright/test';
import path from 'node:path';

const orders = path.join(import.meta.dirname, '..', 'fixtures', 'orders.csv');

for (const [name, viewport] of Object.entries({
  'small phone': { width: 360, height: 640 },
  phone: { width: 390, height: 780 },
  'phone held sideways': { width: 844, height: 390 },
})) {
  test(`the editor is usable on a ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const noSidewaysScroll = async () =>
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

    await page.goto('/');
    await noSidewaysScroll();
    await page.goto('/app');
    await noSidewaysScroll();
    // With nothing loaded, the data panel comes first; loading a file brings up its query.
    await expect(page.getByText('Sample datasets')).toBeVisible();
    await page.getByTestId('file-input').setInputFiles(orders);
    await expect(page.getByTestId('result-summary')).toContainText('5 rows');
    await noSidewaysScroll();

    const box = page.getByLabel('Describe the data you want');
    expect((await box.boundingBox())!.width).toBeGreaterThan(180);
    await box.fill('total per customer');

    // Every control can be reached and lies within the screen.
    for (const control of ['Write SQL', 'Run', 'Explain', 'Save', 'Share', 'CSV', 'Parquet']) {
      const button = page.getByRole('button', { name: control, exact: true });
      await button.scrollIntoViewIfNeeded();
      const bounds = (await button.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    }

    await page.locator('.cm-content').fill('SELECT count(*) AS n FROM orders');
    await page.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(page.getByTestId('result-summary')).toContainText('1 row');
    const table = page.getByTestId('result-table');
    await table.scrollIntoViewIfNeeded();
    // The scrolling area around the rows, not the rows themselves.
    const height = await table.evaluate((el) => {
      let area: Element | null = el;
      while (area && !/auto|scroll/.test(getComputedStyle(area).overflowY)) area = area.parentElement;
      return area?.clientHeight ?? 0;
    });
    expect(height).toBeGreaterThan(200);

    await page.getByRole('button', { name: 'Data', exact: true }).click();
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByTestId('result-summary')).toContainText('5 rows');
    await expect(box).toBeVisible();

    await page.getByRole('button', { name: 'Nothing is uploaded' }).click();
    const dialog = (await page.getByRole('dialog').boundingBox())!;
    expect(dialog.x).toBeGreaterThanOrEqual(0);
    expect(dialog.x + dialog.width).toBeLessThanOrEqual(viewport.width);
  });
}
