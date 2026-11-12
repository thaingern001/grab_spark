import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw new Error('Pass before or after');
const base = process.env.GRABSPARK_PREVIEW_URL ?? 'http://127.0.0.1:3001';
const output = resolve('../docs/screenshots/readability', phase);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.goto(`${base}/?oneclick=1`, { waitUntil: 'networkidle' });
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await page.screenshot({ path: resolve(output, 'recommendation-390.png') });
  await dialog.getByRole('button', { name: 'View details and compare' }).click();
  await dialog.getByRole('heading', { name: 'Compare assumptions' }).waitFor();
  await page.screenshot({ path: resolve(output, 'comparison-390.png') });
  await dialog.getByRole('button', { name: 'Back to review and approval' }).click();
  const consent = dialog.getByRole('checkbox');
  await consent.nth(0).check();
  await consent.nth(1).check();
  await dialog.getByRole('button', { name: /Approve and simulate Bundle/ }).click();
  await page.waitForURL(/\/missions\/[0-9a-f-]+/);
  await page.getByRole('heading', { name: /7-day simulated result/ }).waitFor({ timeout: 20000 });
  const result = await page.locator('main').innerText();
  for (const value of ['฿652.00', '฿956.00', '+฿304.00']) {
    if (!result.includes(value)) throw new Error(`Unexpected result: missing ${value}`);
  }
  await page.screenshot({ path: resolve(output, 'simulated-result-390.png') });
  await page.getByRole('button', { name: 'Mark result as reviewed' }).click();
  await page.getByText('Result review saved').waitFor();
  await page.locator('.app-main').evaluate(element => element.scrollTo(0, 0));
  await page.screenshot({ path: resolve(output, 'result-reviewed-390.png') });
  await page.locator('.account-menu summary').click();
  await page.getByRole('button', { name: 'Reset demo account' }).click();
  await page.waitForURL(`${base}/?oneclick=1`);
  await page.getByRole('dialog').waitFor();
  console.log(`Captured ${phase} screens at 390 px (2× resolution) and reset the preview.`);
} finally {
  await browser.close();
}
