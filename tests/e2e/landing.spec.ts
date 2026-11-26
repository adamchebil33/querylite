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

test('the landing page shows the demo video', async ({ page, request }) => {
  await page.goto('/');
  const video = page.getByTestId('landing-video');
  await expect(video).toBeVisible();
  // The poster is shown until the visitor presses play.
  await expect
    .poll(() => page.evaluate(async () => {
      const img = new Image();
      img.src = document.querySelector('video')!.poster;
      await img.decode();
      return img.naturalWidth;
    }))
    .toBe(1920);
  const file = await request.get('/media/demo.mp4');
  expect(file.status()).toBe(200);
  expect(file.headers()['content-type']).toContain('video/mp4');

  // It previews silently on a loop; "Turn on sound" unmutes it and shows the controls.
  const state = () =>
    video.evaluate((el: HTMLVideoElement) => ({ muted: el.muted, loop: el.loop, controls: el.controls }));
  expect(await state()).toEqual({ muted: true, loop: true, controls: false });
  await page.getByRole('button', { name: 'Turn on sound' }).click();
  await expect(page.getByRole('button', { name: 'Turn on sound' })).toHaveCount(0);
  expect(await state()).toEqual({ muted: false, loop: false, controls: true });
});

test('with reduced motion the demo video waits for the visitor', async ({ browser }) => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.goto('/');
  const video = page.getByTestId('landing-video');
  await expect(video).toBeVisible();
  expect(await video.evaluate((el: HTMLVideoElement) => ({ controls: el.controls, paused: el.paused }))).toEqual({
    controls: true,
    paused: true,
  });
  await expect(page.getByRole('button', { name: 'Turn on sound' })).toHaveCount(0);
  await page.close();
});
