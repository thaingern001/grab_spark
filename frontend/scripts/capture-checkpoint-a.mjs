import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve("../docs/screenshots");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const cases = [
  { name: "home-390x844", width: 390, height: 844, path: "/" },
  { name: "review-390x844", width: 390, height: 844, path: "/opportunity" },
  { name: "home-320x844", width: 320, height: 844, path: "/" },
  { name: "review-320x844", width: 320, height: 844, path: "/opportunity" },
  { name: "home-375x844", width: 375, height: 844, path: "/" },
  { name: "review-430x932", width: 430, height: 932, path: "/opportunity" },
  { name: "desktop-1280x900", width: 1280, height: 900, path: "/" },
];

for (const item of cases) {
  const page = await browser.newPage({ viewport: { width: item.width, height: item.height }, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`http://127.0.0.1:3000${item.path}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: resolve(output, `${item.name}.png`) });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (pageErrors.length) throw new Error(`${item.name}: ${pageErrors.join("; ")}`);
  console.log(`${item.name}: title=${await page.title()} horizontal_overflow=${overflow} page_errors=0`);
  await page.close();
}

for (const [name, path, scrollTop] of [
  ["home-trend-390x844", "/", 470],
  ["review-details-390x844", "/opportunity", 650],
]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:3000${path}`, { waitUntil: "networkidle" });
  await page.locator(".app-main").evaluate((element, position) => { element.scrollTop = position; }, scrollTop);
  await page.screenshot({ path: resolve(output, `${name}.png`) });
  console.log(`${name}: captured scrolled content`);
  await page.close();
}

const journey = await browser.newPage({ viewport: { width: 390, height: 844 } });
await journey.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
await journey.keyboard.press("Tab");
if (!(await journey.locator(".skip-link").evaluate((element) => element === document.activeElement))) {
  throw new Error("Keyboard focus did not reach the skip link");
}
await journey.getByRole("link", { name: /review opportunity/i }).click();
await journey.waitForURL("**/opportunity");
await journey.getByText("Cost assumptions", { exact: true }).click();
await journey.getByText("Cost assumptions", { exact: true }).click();
await journey.getByRole("link", { name: /back to home/i }).click();
await journey.waitForURL("http://127.0.0.1:3000/");
console.log("navigation-and-accordion: passed");
await journey.close();
await browser.close();
