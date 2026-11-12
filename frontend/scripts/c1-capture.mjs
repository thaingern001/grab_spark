import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const phase = process.argv[2];
if (!["before", "after"].includes(phase)) throw new Error("Pass before or after");
const base = process.env.GRABSPARK_PREVIEW_URL ?? "http://127.0.0.1:3001";
const output = resolve("../docs/screenshots/c1", phase);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.goto(`${base}/?oneclick=1`, { waitUntil: "networkidle" });
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  const initialScroll = await dialog.locator(".strategy-sheet-body").evaluate(element => element.scrollTop);
  if (initialScroll !== 0) throw new Error(`Initial recommendation scroll position is ${initialScroll}`);
  if (!await dialog.locator("#popup-title").isVisible()) throw new Error("Recommendation heading is not initially visible");
  await page.screenshot({ path: resolve(output, "01-recommendation.png") });

  const footer = dialog.locator(".strategy-sheet-footer");
  await dialog.locator(".strategy-sheet-card").last().evaluate(element => element.scrollIntoView({ block: "end" }));
  const lastCardBottom = await dialog.locator(".strategy-sheet-card").last().evaluate(element => element.getBoundingClientRect().bottom);
  const footerTop = await footer.evaluate(element => element.getBoundingClientRect().top);
  if (lastCardBottom > footerTop + 1) throw new Error("Sticky footer obscures the last strategy");
  await dialog.locator(".strategy-sheet-body").evaluate(element => element.scrollTo(0, 0));

  await dialog.getByRole("button", { name: "View details and compare" }).click();
  await dialog.getByRole("heading", { name: "Compare assumptions" }).waitFor();
  await page.screenshot({ path: resolve(output, "02-comparison.png") });
  await dialog.getByRole("button", { name: /View Bundle details/ }).click();
  await dialog.getByRole("heading", { name: "Bundle details" }).waitFor();
  await page.screenshot({ path: resolve(output, "bundle-details.png") });
  await dialog.getByRole("button", { name: "Back to review and approval" }).click();
  const consent = dialog.getByRole("checkbox");
  if (await consent.count() !== 2) throw new Error("Expected two mandatory consent checkboxes");
  await consent.nth(0).check();
  await consent.nth(1).check();
  await page.screenshot({ path: resolve(output, "03-approval-ready.png") });
  await dialog.getByRole("button", { name: /Approve and simulate Bundle/ }).click();
  await page.waitForURL(/\/missions\/[0-9a-f-]+/);
  await page.getByRole("heading", { name: /7-day simulated result/ }).waitFor({ timeout: 20000 });
  const result = await page.locator("main").innerText();
  for (const value of ["฿652.00", "฿956.00", "+฿304.00", "25/100"]) {
    if (!result.includes(value)) throw new Error(`Unexpected result: ${value} missing`);
  }
  await page.screenshot({ path: resolve(output, "04-simulated-results.png") });
  await page.getByRole("button", { name: "Mark result as reviewed" }).click();
  await page.getByText("Result review saved").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".app-main").evaluate(element => element.scrollTo(0, 0));
  await page.getByText("Result reviewed").waitFor();
  await page.screenshot({ path: resolve(output, "05-result-reviewed.png") });
  await page.locator(".account-menu summary").click();
  await page.getByRole("button", { name: "Reset demo account" }).click();
  await page.waitForURL(`${base}/?oneclick=1`);
  await page.getByRole("dialog").waitFor();
  console.log(`Captured ${phase} C1 journey at 390px CSS / 2× resolution; initial scroll ${initialScroll}; preview reset.`);
} finally {
  await browser.close();
}
