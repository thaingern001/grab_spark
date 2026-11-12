import { chromium } from 'playwright';

const base = process.env.GRABSPARK_PREVIEW_URL ?? 'http://127.0.0.1:3001';
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${base}/?oneclick=1`, { waitUntil: 'networkidle' });
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const consent = dialog.getByRole('checkbox');
  await consent.nth(0).check();
  await consent.nth(1).check();
  await dialog.getByRole('button', { name: /Approve and simulate Bundle/ }).click();
  await page.waitForURL(/\/missions\/[0-9a-f-]+/);
  await page.getByRole('heading', { name: /7-day simulated result/ }).waitFor({ timeout: 20000 });
  const resultUrl = page.url();

  for (const width of [320, 375, 390, 430]) {
    const resultPage = await browser.newPage({ viewport: { width, height: 844 } });
    await resultPage.goto(resultUrl, { waitUntil: 'networkidle' });
    await resultPage.getByRole('heading', { name: /7-day simulated result/ }).waitFor();
    const overflow = await resultPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (overflow) throw new Error(`${width}px: result page has horizontal overflow`);
    const amounts = await resultPage.locator('.results-totals strong, .results-difference strong').evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      return { text: element.textContent, left: box.left, right: box.right, clipped: element.scrollWidth > element.clientWidth + 1 };
    }));
    if (amounts.length !== 3 || amounts.some(amount => amount.clipped || amount.left < 0 || amount.right > width)) throw new Error(`${width}px: result amount clipped: ${JSON.stringify(amounts)}`);
    await resultPage.close();
  }

  await page.getByRole('button', { name: 'Mark result as reviewed' }).click();
  await page.getByText('Result review saved').waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Result reviewed').waitFor();
  await page.locator('.account-menu summary').click();
  await page.getByRole('button', { name: 'Reset demo account' }).click();
  await page.waitForURL(`${base}/?oneclick=1`);
  console.log('Results and reviewed badge fit 320/375/390/430 px; preview reset.');
} finally {
  await browser.close();
}
