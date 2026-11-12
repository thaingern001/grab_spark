import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

if (process.env.GRABSPARK_E2E_MUTATE_SEED !== "1") throw new Error("This test changes a synthetic mission. Set GRABSPARK_E2E_MUTATE_SEED=1 and use a disposable seeded database.");
const base = process.env.PROTOTYPE_URL ?? "http://127.0.0.1:3000";
const output = resolve("../docs/screenshots/checkpoint-b");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const [name, path] of [["home", "/"], ["orders", "/orders"], ["menu", "/menu"], ["performance", "/performance"], ["ai", "/ai"], ["missions", "/missions"]]) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    if (await page.locator(".state-panel").count()) throw new Error(`${path}: error state shown`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (overflow) throw new Error(`${path}: horizontal overflow`);
    await page.screenshot({ path: resolve(output, `${name}-390.png`), fullPage: true });
  }
  await page.goto(base + "/opportunity", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /ตรวจทานก่อนทดลอง Bundle/ }).click();
  await page.getByRole("button", { name: /ตรวจหรือแก้ต้นทุน/ }).click();
  const proposedFood = page.getByRole("textbox", { name: "ชุดที่เสนอ ต้นทุนอาหาร" });
  const original = await proposedFood.inputValue();
  await proposedFood.fill((Number(original) + 1).toFixed(2));
  await page.getByRole("button", { name: /บันทึกและคำนวณใหม่/ }).click();
  await page.getByText(/QUICK REVIEW · รุ่นข้อมูล 2/).waitFor();
  await page.screenshot({ path: resolve(output, "compare-390.png"), fullPage: true });
  await page.getByRole("button", { name: /ยืนยันข้อมูลและอนุมัติ/ }).click();
  await page.getByRole("checkbox").nth(0).check();
  await page.getByRole("checkbox").nth(1).check();
  await page.getByRole("button", { name: /อนุมัติการทดลองจำลอง/ }).click();
  await page.waitForURL(/\/missions\/[0-9a-f-]+$/);
  await page.getByRole("button", { name: /สร้างผลจำลอง/ }).click();
  await page.locator(".outcome-section .section-kicker").getByText("ตรวจผลจำลอง").waitFor();
  await page.screenshot({ path: resolve(output, "outcome-390.png"), fullPage: true });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".outcome-section .section-kicker").getByText("ตรวจผลจำลอง").waitFor();
  await page.getByRole("button", { name: /บันทึกว่าตรวจผลแล้ว/ }).click();
  await page.getByText("บันทึกการตรวจผลแล้ว").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("บันทึกการตรวจผลแล้ว").waitFor();
  if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
  console.log("Checkpoint B full journey passed: cost save, backend comparison, approval, simulation, persisted review.");
  await page.close();
} finally { await browser.close(); }
