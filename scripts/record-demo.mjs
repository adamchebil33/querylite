// Records the demo GIF shown in the README.
// Start the app first (npm run dev), then run: npm run record
// Needs ImageMagick ("magick" or "convert") to assemble the frames.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:5173';
const root = path.join(import.meta.dirname, '..');
const framesDir = path.join(root, '.cache', 'demo-frames');
const output = path.join(root, 'docs', 'demo.gif');
const FRAME_MS = 140;

await rm(framesDir, { recursive: true, force: true });
await mkdir(framesDir, { recursive: true });
await mkdir(path.dirname(output), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 720 },
  colorScheme: 'light',
  deviceScaleFactor: 1,
});

// Take a frame at a steady interval while the scripted actions run.
let frame = 0;
let recording = true;
const recorder = (async () => {
  while (recording) {
    const started = Date.now();
    const name = `frame-${String(frame++).padStart(4, '0')}.png`;
    await page.screenshot({ path: path.join(framesDir, name) }).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, FRAME_MS - (Date.now() - started))));
  }
})();
const pause = (ms) => page.waitForTimeout(ms);

/** Moves the pointer to an element so the viewer can follow the click. */
async function click(locator) {
  const box = await locator.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
  await pause(250);
  await locator.click();
}

await page.goto(base);
await pause(1800);
await click(page.getByRole('button', { name: /Try it on 2.9 million taxi trips/ }));
await page.getByTestId('result-summary').waitFor({ timeout: 60_000 });
await page.getByTestId('chart').locator('svg').waitFor();
await pause(2200);
await click(page.getByRole('button', { name: 'Top 10 pickup zones' }));
await pause(2400);
await click(page.getByRole('button', { name: 'Trips and revenue per day' }));
await pause(2400);
await click(page.getByRole('button', { name: 'Sort by trips' }));
await pause(600);
await click(page.getByRole('button', { name: 'Sort by trips' }));
await pause(1800);
await click(page.getByRole('button', { name: 'Switch to dark mode' }));
await pause(2200);

recording = false;
await recorder;
await browser.close();

const frames = (await readdir(framesDir)).sort().map((name) => path.join(framesDir, name));
const magick = ['magick', 'convert'].find((command) => {
  try {
    execFileSync(command, ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
});
if (!magick) {
  console.error(`ImageMagick not found. Frames are in ${framesDir}`);
  process.exit(1);
}
execFileSync(magick, [
  '-delay', String(FRAME_MS / 10),
  '-loop', '0',
  ...frames,
  '-resize', '900x',
  '+dither',
  '-colors', '200',
  '-layers', 'Optimize',
  output,
]);
console.log(`wrote ${path.relative(process.cwd(), output)} from ${frames.length} frames`);
