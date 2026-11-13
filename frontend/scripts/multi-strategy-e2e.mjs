import { chromium } from "playwright";
import { resolve } from "node:path";

const base = process.env.GRABSPARK_PREVIEW_URL ?? "http://127.0.0.1:3001";
const browser = await chromium.launch({ headless: true });
const shots = resolve("../docs/screenshots/strategy");
try {
  for (const width of [320, 375, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base, { waitUntil: "networkidle" });
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    await dialog.getByRole("heading", { name: "Recommended: Bundle" }).waitFor();
    if (await dialog.locator(".strategy-sheet-card").count() !== 3) throw new Error(`Missing strategies at ${width}`);
    if (width === 390) {
      const cards = await dialog.locator(".strategy-sheet-card").allTextContents();
      for (const [index, impact, risk] of [[0, "+฿304.00", "25/100"], [1, "+฿63.00", "29/100"], [2, "+฿95.60", "35/100"]]) {
        if (!cards[index].includes(impact) || !cards[index].includes(risk)) throw new Error(`Moderate scenario card mismatch: ${cards[index]}`);
      }
    }
    if (await dialog.locator(".strategy-sheet-card img").count() !== 3 || !await dialog.locator(".strategy-sheet-card img").evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))) throw new Error(`Concept previews failed at ${width}`);
    if (await dialog.getByText("AI-generated concept preview", { exact: false }).count() !== 3) throw new Error(`Concept labels missing at ${width}`);
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error(`Horizontal document scroll at ${width}`);
    if (await dialog.locator(".strategy-sheet-body").evaluate(el => el.scrollWidth > el.clientWidth)) throw new Error(`Horizontal sheet scroll at ${width}`);
    if (await dialog.getByRole("button", { name: /Approve and simulate/ }).isEnabled()) throw new Error("Approval enabled without consent");
    if (width === 390) await page.screenshot({ path: resolve(shots, "multi-popup-390.png") });
    await dialog.getByRole("button", { name: "View details and compare" }).click();
    await dialog.getByRole("heading", { name: "Compare assumptions" }).waitFor();
    if (width === 390) await page.screenshot({ path: resolve(shots, "multi-compare-390.png") });
    await dialog.getByRole("button", { name: /View Bundle details/ }).click();
    await dialog.getByRole("heading", { name: "Bundle details" }).waitFor();
    await dialog.getByText("Expand strategy concept preview").click();
    await dialog.locator(".strategy-visual.is-detail img").waitFor();
    if (width === 390) await page.screenshot({ path: resolve(shots, "multi-detail-390.png") });
    await dialog.getByRole("button", { name: "Back to review and approval" }).click();
    await dialog.getByRole("button", { name: "Close One Click recommendation" }).click();
    await dialog.waitFor({ state: "hidden" });
    if (width === 390) {
      await page.screenshot({ path: resolve(shots, "visual-home-390.png") });
      await page.locator(".home-recommendation-link").click();
      await dialog.waitFor();
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      await page.waitForURL(base + "/");
    }
    await page.reload({ waitUntil: "networkidle" });
    await dialog.waitFor();
    await dialog.getByRole("button", { name: "Close One Click recommendation" }).click();
    await dialog.waitFor({ state: "hidden" });
    if (errors.length) throw new Error(`${width}px page errors: ${errors.join("; ")}`);
    await context.close();
  }

  const fallbackContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const fallbackPage = await fallbackContext.newPage();
  await fallbackPage.route("**/_next/image?**", route => route.abort());
  await fallbackPage.goto(`${base}/?oneclick=1`, { waitUntil: "networkidle" });
  await fallbackPage.waitForFunction(() => document.querySelectorAll('[role="dialog"] .strategy-visual-fallback').length === 3);
  await fallbackContext.close();

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/?oneclick=1`, { waitUntil: "networkidle" });
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.getByRole("button", { name: "View details and compare" }).click();
  await dialog.getByRole("button", { name: "Edit unit prices and costs" }).click();
  const foodCost = dialog.getByLabel("Proposed bundle Food cost");
  await foodCost.fill((Number(await foodCost.inputValue()) + 1).toFixed(2));
  await dialog.getByRole("button", { name: "Save and recalculate" }).click();
  await dialog.getByRole("heading", { name: "Compare assumptions" }).waitFor();
  await dialog.getByRole("button", { name: "Edit volume and spending assumptions" }).click();
  const demand = dialog.getByLabel("Bundle units over 7 days");
  await demand.fill("39");
  await dialog.getByRole("button", { name: "Save and recalculate" }).click();
  await dialog.getByRole("heading", { name: "Compare assumptions" }).waitFor();
  await dialog.getByRole("button", { name: "Back to review and approval" }).click();
  const cards = await dialog.locator(".strategy-sheet-card").allTextContents();
  if (!cards[0].includes("Bundle") || !cards[0].includes("+฿")) throw new Error(`Unexpected backend recalculation: ${cards[0]}`);
  const checkboxes = dialog.getByRole("checkbox");
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await dialog.getByRole("button", { name: /View Bundle details/ }).click();
  await dialog.getByRole("button", { name: "Back to review and approval" }).click();
  if (!await checkboxes.nth(0).isChecked() || !await checkboxes.nth(1).isChecked()) throw new Error("Consent was lost during optional details navigation");
  let approvals = 0;
  page.on("request", request => { if (/\/api\/merchant\/missions\/[^/]+\/approve$/.test(request.url())) approvals += 1; });
  await page.route("**/api/merchant/missions/*/simulate", async route => { await new Promise(resolve => setTimeout(resolve, 1800)); await route.continue(); });
  await dialog.getByRole("button", { name: /Approve and simulate/ }).click();
  await page.waitForURL(/\/missions\/[0-9a-f-]+/);
  await page.getByRole("heading", { name: "Generating simulated result" }).waitFor();
  await page.screenshot({ path: resolve(shots, "multi-processing-390.png") });
  await page.getByRole("heading", { name: /7-day simulated result/ }).waitFor({ timeout: 20000 });
  if (approvals !== 1) throw new Error(`Expected one approval request, got ${approvals}`);
  const result = await page.locator("main").innerText();
  if (!result.includes("Bundle") || !result.includes("40 modeled orders") || !result.includes("simulation")) throw new Error(`Missing result data: ${result.slice(0, 600)}`);
  await page.screenshot({ path: resolve(shots, "multi-result-390.png") });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /7-day simulated result/ }).waitFor();
  await page.getByRole("button", { name: /Mark result as reviewed/ }).click();
  await page.getByText("Result review saved").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Result review saved").waitFor();
  await page.screenshot({ path: resolve(shots, "visual-reviewed-390.png") });
  await page.getByRole("link", { name: "Back to Home" }).click();
  await page.waitForURL(base + "/");
  await page.locator(".merchant-highlights").waitFor();
  if (await page.getByRole("button", { name: /Reset demo account/ }).isVisible()) throw new Error("Account reset appeared outside Profile");
  await page.locator(".account-menu summary").click();
  await page.getByRole("button", { name: /Reset demo account/ }).waitFor();
  await page.screenshot({ path: resolve(shots, "demo-reset-before-390.png") });
  await page.getByRole("button", { name: /Reset demo account/ }).click();
  await page.waitForURL(`${base}/?oneclick=1`);
  await page.getByRole("dialog").waitFor();
  if (await page.locator(".strategy-sheet-card").count() !== 3) throw new Error("Demo reset did not restore the recommendation");
  await page.screenshot({ path: resolve(shots, "demo-reset-after-390.png") });
  if (errors.length) throw new Error(`Journey page errors: ${errors.join("; ")}`);
  console.log("One Click journey passed: 4 mobile widths, approval, simulation, reviewed state, Profile account reset, and restored recommendation.");
  await context.close();
} finally {
  await browser.close();
}
