import { chromium } from "playwright";

const base = process.env.GRABSPARK_PREVIEW_URL ?? "http://127.0.0.1:3001";
const routes = ["/", "/orders", "/menu", "/performance", "/ai", "/missions", "/opportunity"];
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  for (const route of routes) {
    const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
    if (!response?.ok()) throw new Error(`${route}: HTTP ${response?.status()}`);
    if (await page.locator("html").getAttribute("lang") !== "en") throw new Error(`${route}: document language is not English`);
    const text = (await page.locator("body").innerText()).replaceAll("฿", "");
    if (/[ก-๙]/u.test(text)) throw new Error(`${route}: Thai copy remains in visible UI`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (overflow) throw new Error(`${route}: horizontal overflow`);
  }

  await page.goto(`${base}/?oneclick=1`, { waitUntil: "networkidle" });
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  const popupText = (await dialog.innerText()).replaceAll("฿", "");
  if (/[ก-๙]/u.test(popupText)) throw new Error("One Click popup: Thai copy remains in visible UI");
  console.log(`English UI passed: ${routes.length} sections and One Click popup at 390 px.`);
} finally {
  await browser.close();
}
