import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const base = process.env.A1_PREVIEW_URL ?? "http://127.0.0.1:3001";
const output = resolve("../docs/screenshots/checkpoint-a1/after");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 375, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    for (const [name, path] of [["home", "/"], ["orders", "/orders"], ["menu", "/menu"], ["insights", "/performance"], ["ai", "/ai"], ["review", "/opportunity"]]) {
      const response = await page.goto(base + path, { waitUntil: "networkidle" });
      if (response.status() !== 200 || await page.locator(".state-panel").count()) throw new Error(`${width}px ${path}: page did not load`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth || document.querySelector(".app-main").scrollWidth > document.querySelector(".app-main").clientWidth);
      if (overflow) throw new Error(`${width}px ${path}: horizontal overflow`);
      if (width === 390) await page.screenshot({ path: resolve(output, `${name}.png`) });
      await page.locator(".app-main").evaluate(element => { element.scrollTop = element.scrollHeight; });
      const visibleEnd = await page.evaluate(() => { const main = document.querySelector(".app-main"); const last = main.querySelector(".page-content")?.lastElementChild; return !last || last.getBoundingClientRect().bottom <= main.getBoundingClientRect().bottom + 1; });
      if (!visibleEnd) throw new Error(`${width}px ${path}: last content hidden behind navigation`);
    }
    await page.goto(base + "/", { waitUntil: "networkidle" });
    await page.keyboard.press("Tab");
    if (!await page.locator(".skip-link").evaluate(element => element === document.activeElement)) throw new Error("Skip link is not first in keyboard order");
    await page.locator(".account-menu summary").focus();
    await page.keyboard.press("Enter");
    if (!await page.locator(".account-popover").isVisible()) throw new Error("Account information did not open by keyboard");
    await page.getByRole("link", { name: "ดูโอกาสนี้" }).click();
    await page.waitForURL("**/opportunity?**");
    if (!(await page.locator(".difference-strip strong").innerText()).includes("+฿8.00")) throw new Error("Backend scenario difference missing");
    await page.getByText("ดูสมมติฐานและรายละเอียดการคำนวณ").click();
    if (!(await page.locator(".assumptions-details").innerText()).includes("กำไรสมทบ ฿24.30")) throw new Error("Backend financial breakdown missing");
    await page.getByRole("button", { name: "ตรวจสอบต้นทุน" }).click();
    const foodCost = page.getByRole("textbox", { name: "ชุดที่เสนอ ต้นทุนอาหาร" });
    const original = await foodCost.inputValue();
    await foodCost.fill("-1");
    if (await page.getByRole("button", { name: /บันทึกและเปรียบเทียบ/ }).isEnabled()) throw new Error("Invalid cost did not block saving");
    await foodCost.fill(original);
    const costOverflow = await page.evaluate(() => document.querySelector(".app-main").scrollWidth > document.querySelector(".app-main").clientWidth);
    if (costOverflow) throw new Error(`${width}px cost form: horizontal overflow`);
    await page.getByRole("button", { name: "เปรียบเทียบ" }).click();
    if (!await page.getByText(/ข้อมูลรุ่นที่ 1/).count()) throw new Error("Scenario revision missing");
    await page.getByRole("button", { name: /ตรวจภารกิจ/ }).click();
    if (await page.getByRole("button", { name: /อนุมัติการทดลองจำลอง/ }).isEnabled()) throw new Error("Approval enabled without explicit consent");
    if (pageErrors.length) throw new Error(`${width}px browser errors: ${pageErrors.join("; ")}`);
    console.log(`${width}px: six screens, navigation, review, cost validation, keyboard, and scroll passed`);
    await page.close();
  }
} finally { await browser.close(); }
