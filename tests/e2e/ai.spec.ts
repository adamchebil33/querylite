import { expect, test, type Page, type Route } from '@playwright/test';
import path from 'node:path';
import type { AiRequest } from '../../shared/ai';

const fixture = (name: string) => path.join(import.meta.dirname, '..', 'fixtures', name);

// Every value that appears in the fixture files' cells, plus the file names.
const DATA_VALUES = [
  'Ada', 'Grace', 'Linus', 'London', 'New York', 'Helsinki',
  '25.5', '100.0', '14.25', '60.0', '5.75', '2025-01-03', '2025-02-15', '2025-03-01',
  'orders.csv', 'customers.json',
];

/** Replaces the AI endpoint with a canned reply and records what the page sent. */
async function mockAi(page: Page, answer: (request: AiRequest) => { status?: number; body: unknown }) {
  const requests: string[] = [];
  await page.route('**/api/ai', async (route: Route) => {
    const raw = route.request().postData() ?? '';
    requests.push(raw);
    const { status = 200, body } = answer(JSON.parse(raw) as AiRequest);
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return requests;
}

async function loadFixtures(page: Page) {
  await page.goto('/app');
  await page
    .getByTestId('file-input')
    .setInputFiles([fixture('orders.csv'), fixture('customers.json')]);
  await expect(page.getByTestId('table-item')).toHaveCount(2);
  await expect(page.getByTestId('result-summary')).toContainText('5 rows');
}

async function ask(page: Page, question: string) {
  await page.getByLabel('Ask a question in plain English').fill(question);
  await page.getByRole('button', { name: 'Write SQL' }).click();
}

const cells = (page: Page, row: number) =>
  page.getByTestId('result-table').locator(`[aria-rowindex="${row + 2}"]`).getByRole('cell');

test('asking in English sends only the schema, and never runs the SQL by itself', async ({ page }) => {
  const requests = await mockAi(page, () => ({
    body: { ok: true, text: 'SELECT c.city, sum(o.amount) AS total FROM orders o JOIN customers c USING (customer_id) GROUP BY c.city ORDER BY total DESC' },
  }));
  await loadFixtures(page);
  await ask(page, 'total sales per city');

  await expect(page.getByTestId('ai-notice')).toContainText('Review it, then press Run');
  await expect(page.locator('.cm-content')).toContainText('GROUP BY c.city');
  // Not run: the earlier result is still showing.
  await expect(page.getByTestId('result-summary')).toContainText('5 rows');

  // The request holds the question and the schema, and no cell value or file name.
  expect(requests).toHaveLength(1);
  const sent = JSON.parse(requests[0]) as AiRequest;
  expect(Object.keys(sent).sort()).toEqual(['question', 'schema', 'task']);
  expect(sent.question).toBe('total sales per city');
  expect(sent.schema).toEqual([
    {
      name: 'orders',
      columns: [
        { name: 'order_id', type: 'BIGINT' },
        { name: 'customer_id', type: 'BIGINT' },
        { name: 'amount', type: 'DOUBLE' },
        { name: 'ordered_at', type: 'DATE' },
      ],
    },
    {
      name: 'customers',
      columns: [
        { name: 'customer_id', type: 'BIGINT' },
        { name: 'name', type: 'VARCHAR' },
        { name: 'city', type: 'VARCHAR' },
      ],
    },
  ]);
  for (const value of DATA_VALUES) expect(requests[0]).not.toContain(value);

  // The user runs it themselves.
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByTestId('result-summary')).toContainText('3 rows');
  await expect(cells(page, 0)).toHaveText(['New York', '105.75']);
});

test('AI answers that are not a single read-only query are discarded', async ({ page }) => {
  let reply = 'DROP TABLE orders';
  await mockAi(page, () => ({ body: { ok: true, text: reply } }));
  await loadFixtures(page);

  for (const dangerous of [
    'DROP TABLE orders',
    'SELECT 1; DROP TABLE orders',
    'DELETE FROM orders',
    "COPY orders TO 'out.csv'",
    'Sure! Here is your query',
  ]) {
    reply = dangerous;
    await ask(page, 'delete everything');
    await expect(page.getByTestId('ai-notice')).toContainText('discarded');
    await expect(page.locator('.cm-content')).toHaveText('SELECT * FROM orders LIMIT 100;');
    await page.getByTestId('ai-notice').getByRole('button', { name: 'Dismiss' }).click();
  }
  await expect(page.getByTestId('table-item')).toHaveCount(2);
});

test('fixing an error sends the error text with data values removed', async ({ page }) => {
  const requests = await mockAi(page, () => ({
    body: { ok: true, text: 'SELECT length(name) AS name_length FROM customers' },
  }));
  await loadFixtures(page);
  const editor = page.locator('.cm-content');
  await editor.fill('SELECT name::INT AS n FROM customers');
  await editor.press('ControlOrMeta+Enter');
  // The database's error quotes a real cell value.
  await expect(page.getByTestId('query-error')).toContainText("'Ada'");

  await page.getByRole('button', { name: 'Fix with AI' }).click();
  await expect(page.getByTestId('ai-notice')).toContainText('suggested a fix');
  await expect(editor).toHaveText('SELECT length(name) AS name_length FROM customers');

  const sent = JSON.parse(requests[0]) as AiRequest;
  expect(sent.task).toBe('fix');
  expect(sent.sql).toBe('SELECT name::INT AS n FROM customers');
  expect(sent.error).toContain('Could not convert');
  for (const value of DATA_VALUES) expect(requests[0]).not.toContain(value);
});

test('explains a query in plain English', async ({ page }) => {
  await mockAi(page, (request) => ({
    body: { ok: true, text: `It lists the first rows. (task: ${request.task})` },
  }));
  await loadFixtures(page);
  await page.getByRole('button', { name: 'Explain' }).click();
  await expect(page.getByTestId('ai-notice')).toContainText('What this query does: It lists the first rows. (task: explain)');
});

test('when AI is rate-limited or down the app says so and keeps working', async ({ page }) => {
  let status = 429;
  await mockAi(page, () => ({
    status,
    body:
      status === 429
        ? { ok: false, error: 'rate_limited', message: 'Too many AI requests. Please wait a minute and try again.' }
        : '<html>gateway error</html>',
  }));
  await loadFixtures(page);

  await ask(page, 'anything');
  await expect(page.getByTestId('ai-notice')).toContainText('Too many AI requests');
  status = 502;
  await ask(page, 'anything');
  await expect(page.getByTestId('ai-notice')).toContainText('AI is unavailable right now');

  const editor = page.locator('.cm-content');
  await editor.fill('SELECT count(*) AS n FROM orders');
  await editor.press('ControlOrMeta+Enter');
  await expect(cells(page, 0)).toHaveText(['5']);
});

test('the real endpoint fails gracefully where no AI is available', async ({ page }) => {
  // No mock: locally the Worker has no AI model behind it, like when the daily allowance is used up.
  await loadFixtures(page);
  await ask(page, 'total sales per city');
  await expect(page.getByTestId('ai-notice')).toContainText('AI is unavailable right now');
  await expect(page.getByTestId('result-summary')).toContainText('5 rows');
});
