import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { chromium } from "playwright";

const source = readFileSync(resolve("lib/format.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleShim = { exports: {} };
new Function("module", "exports", compiled)(moduleShim, moduleShim.exports);
const { impactTone, baht } = moduleShim.exports;
assert.equal(impactTone("271.40"), "positive");
assert.equal(impactTone("-154.80"), "negative");
assert.equal(impactTone("0.00"), "zero");
assert.equal(impactTone("-0.00"), "zero");

const base = "http://127.0.0.1:3001";
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 375, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await page.goto(`${base}/?oneclick=1`, { waitUntil: "networkidle" });
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    await dialog.getByText("คะแนนความเสี่ยงจำลอง (0–100) · ยิ่งต่ำยิ่งเสี่ยงน้อย").waitFor();
    const rows = dialog.locator(".strategy-sheet-cards .strategy-sheet-card");
    assert.equal(await rows.count(), 3);
    const missionId = new URL(await page.locator(".home-recommendation-link").getAttribute("href"), base).searchParams.get("id");
    const response = await page.request.get(`${base}/api/merchant/missions/${missionId}/strategies`);
    assert.equal(response.status(), 200);
    const evaluation = await response.json();
    const cases = [evaluation.strategies.find(item => item.strategy_id === evaluation.recommended_strategy_id), ...evaluation.strategies.filter(item => item.strategy_id !== evaluation.recommended_strategy_id)];
    const fills = [];
    for (let index = 0; index < 3; index++) {
      const item = cases[index];
      const row = rows.nth(index);
      const impact = row.locator(".strategy-sheet-card-metric strong");
      assert.equal(await impact.innerText(), baht(item.estimated_difference, true));
      assert.equal(await impact.evaluate(el => [...el.classList].find(name => name.startsWith("impact-"))), `impact-${impactTone(item.estimated_difference)}`);
      const bar = await row.locator(".strategy-risk-track i").evaluate(el => ({ width: el.style.width, color: getComputedStyle(el).backgroundColor }));
      assert.equal(bar.width, `${item.risk_score}%`);
      fills.push(bar.color);
    }
    assert.equal(new Set(fills).size, 1, "Risk bars must use a consistent neutral color");
    const colors = await rows.locator(".strategy-sheet-card-metric strong").evaluateAll(elements => elements.map(el => getComputedStyle(el).color));
    assert.notEqual(colors[0], colors[1]);
    assert.equal(colors[1], colors[2]);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await dialog.locator(".strategy-sheet-body").evaluate(el => el.scrollWidth > el.clientWidth), false);
    assert.equal(await dialog.getByRole("checkbox").count(), 2);
    assert.equal(await dialog.getByRole("button", { name: /อนุมัติและเริ่มจำลอง/ }).isDisabled(), true);
    if (width === 390 || width === 320) await page.screenshot({ path: resolve(`../docs/screenshots/strategy/popup-polish-${width}.png`) });
    await dialog.getByRole("button", { name: /ดูรายละเอียด Discount/ }).click();
    const detailImpact = dialog.locator(".strategy-detail-highlight strong.impact-negative");
    assert.equal(await detailImpact.innerText(), baht(evaluation.strategies.find(item => item.strategy_id === "discount").estimated_difference, true));
    assert.equal(await dialog.locator(".strategy-breakdown strong.impact-negative").count(), 1);
    await page.close();
  }
  console.log("Popup polish passed: backend values, positive/negative/zero tone, risk explanation and bars, detail impact, four mobile widths, consent gating.");
} finally {
  await browser.close();
}
