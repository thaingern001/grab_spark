import { chromium } from "playwright";
import { resolve } from "node:path";

const base = process.env.GRABSPARK_PREVIEW_URL ?? "http://127.0.0.1:3001";
const shots = resolve("../docs/screenshots/strategy");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/?oneclick=1`, { waitUntil: "networkidle" });
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  const cards = await dialog.locator(".strategy-sheet-card").allTextContents();
  for (const [index, impact, risk] of [[0, "+฿304.00", "25/100"], [1, "+฿63.00", "29/100"], [2, "+฿95.60", "35/100"]]) {
    if (!cards[index].includes(impact) || !cards[index].includes(risk)) throw new Error(`Unexpected seeded comparison: ${cards[index]}`);
  }
  if (!await dialog.getByText("Extra orders are synthetic assumptions", { exact: false }).isVisible()) throw new Error("Synthetic demand disclosure missing");
  await page.screenshot({ path: resolve(shots, "moderate-popup-390.png") });
  await dialog.getByRole("button", { name: /View Bundle details/ }).click();
  await dialog.getByRole("heading", { name: "Bundle details" }).waitFor();
  await page.screenshot({ path: resolve(shots, "moderate-detail-390.png") });
  await dialog.getByRole("button", { name: "Back to review and approval" }).click();
  const consents = dialog.getByRole("checkbox");
  if (await consents.count() !== 2) throw new Error("Expected two explicit consent checkboxes");
  await consents.nth(0).check();
  await consents.nth(1).check();
  await dialog.getByRole("button", { name: /Approve and simulate Bundle/ }).click();
  await page.waitForURL(/\/missions\/[0-9a-f-]+/);
  await page.getByRole("heading", { name: /7-day simulated result/ }).waitFor({ timeout: 20000 });
  const result = await page.locator("main").innerText();
  for (const expected of ["฿652.00", "฿956.00", "+฿304.00"]) {
    if (!result.includes(expected)) throw new Error(`Missing approved snapshot value ${expected}: ${result.slice(0, 600)}`);
  }
  const missionId = new URL(page.url()).pathname.split("/").at(-1);
  const outcomeResponse = await page.request.get(`${base}/api/merchant/missions/${missionId}/outcome`);
  if (!outcomeResponse.ok()) throw new Error(`Outcome API error ${outcomeResponse.status()}`);
  const outcome = await outcomeResponse.json();
  if (outcome.simulation_version !== "multi-strategy-v2" || outcome.baseline.estimated_contribution !== "652.00" || outcome.trial.estimated_contribution !== "956.00") throw new Error("Result differs from approved snapshot");
  await page.screenshot({ path: resolve(shots, "moderate-result-390.png") });
  if (errors.length) throw new Error(`Page errors: ${errors.join("; ")}`);
  await page.locator(".account-menu summary").click();
  await page.getByRole("button", { name: /Reset demo account/ }).click();
  await page.waitForURL(`${base}/?oneclick=1`);
  await page.getByRole("dialog").waitFor();
  console.log("Moderate scenario passed: seeded comparison, consent, immutable result, screenshots, and deterministic reset.");
} finally {
  await browser.close();
}
