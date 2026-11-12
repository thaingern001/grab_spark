import { chromium } from "playwright";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const source = resolve("../docs/presentation/one-click-journey.html");
const output = resolve("../docs/presentation/one-click-journey.png");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(source).href, { waitUntil: "load" });
  await page.locator("img").evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await page.locator("main").screenshot({ path: output });
  console.log(output);
} finally {
  await browser.close();
}
