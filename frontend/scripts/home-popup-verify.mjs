import { chromium } from "playwright";
import { resolve } from "node:path";

const base = process.env.GRABSPARK_PREVIEW_URL ?? "http://127.0.0.1:3001";
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "networkidle" });
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    await dialog.getByRole("heading", { name: "Recommended: Bundle" }).waitFor();
    if (width === 390) await page.screenshot({ path: resolve("../docs/screenshots/strategy/home-popup-390.png") });
    await dialog.getByRole("button", { name: "Close One Click recommendation" }).click();
    await dialog.waitFor({ state: "hidden" });
    const card = page.locator(".home-recommendation.is-opportunity");
    await card.waitFor();
    if (width === 390) await page.screenshot({ path: resolve("../docs/screenshots/strategy/home-card-390.png") });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error(`${width}px Home overflow`);
    await page.reload({ waitUntil: "networkidle" });
    await dialog.waitFor();
    await dialog.getByRole("button", { name: "Close One Click recommendation" }).click();
    await card.getByRole("link", { name: "View recommendation" }).click();
    await page.waitForURL(/\/opportunity\?/);
    await context.close();
  }
  console.log("Home recommendation passed: automatic popup on entry and reload, dismissal to highlighted card, and 320/390/430px layouts.");
} finally { await browser.close(); }
