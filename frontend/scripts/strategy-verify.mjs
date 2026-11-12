import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const base = process.env.PROTOTYPE_URL ?? "http://127.0.0.1:3001";
if (base !== "http://127.0.0.1:3001") throw new Error("Run only against the disposable visual preview on port 3001");
const output = resolve("../docs/screenshots/strategy");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
async function capture(page, file) {
  const style = await page.addStyleTag({ content: ".phone-frame{height:auto!important;max-height:none!important;overflow:visible!important}.app-main{overflow:visible!important}.desktop-stage{display:block!important;min-height:0!important}.bottom-nav{position:static!important}" });
  await page.screenshot({ path: resolve(output, file), fullPage: true });
  await style.evaluate(node => node.remove());
}
try {
  for (const width of [320, 375, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base + "/opportunity", { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Guided Missions" }).waitFor();
    const rowsOverflow = await page.locator(".strategy-ranked-list").evaluate(node => node.scrollWidth > node.clientWidth);
    if (rowsOverflow) throw new Error(`Strategy rows overflow at ${width}px`);
    if (width === 390) {
      const actionOverflow = await page.evaluate(() => {
        const button = document.querySelector(".strategy-landing-actions .primary-button");
        const main = document.querySelector(".app-main");
        return button && main ? button.getBoundingClientRect().bottom - main.getBoundingClientRect().bottom : Infinity;
      });
      if (actionOverflow > 0) throw new Error(`Primary action is ${Math.round(actionOverflow)}px below the first 390×844 viewport`);
    }
    await capture(page, `recommended-${width}.png`);
    if (width === 390) await page.getByRole("button", { name: /Discount แนวคิดที่ยังไม่มีแบบจำลอง/ }).click();
    else await page.getByRole("button", { name: "ดูรายละเอียดเปรียบเทียบ" }).click();
    await page.getByText("แนวคิด · ยังไม่มีแบบจำลอง").first().waitFor();
    if (await page.getByText("แนวคิด · ยังไม่มีแบบจำลอง").count() !== 2) throw new Error("Unsupported strategies missing labels");
    await capture(page, `compare-${width}.png`);
    await page.getByRole("button", { name: "ดูรายละเอียด Bundle" }).click();
    await page.getByRole("heading", { name: "รายละเอียดกลยุทธ์" }).waitFor();
    await capture(page, `detail-${width}.png`);
    await page.getByRole("button", { name: "ไปตรวจทาน" }).click();
    await page.getByRole("heading", { name: "ตรวจทานอย่างรวดเร็ว" }).waitFor();
    if (width === 390) {
      const reviewOverflow = await page.evaluate(() => document.querySelector(".strategy-panel .primary-button").getBoundingClientRect().bottom - document.querySelector(".app-main").getBoundingClientRect().bottom);
      if (reviewOverflow > 0) throw new Error(`Quick Review primary action is ${Math.round(reviewOverflow)}px below the viewport`);
    }
    await capture(page, `review-${width}.png`);
    await page.getByRole("button", { name: "ยืนยันข้อมูลและอนุมัติ" }).click();
    if (width === 390) {
      const approvalOverflow = await page.evaluate(() => document.querySelector(".strategy-panel .primary-button").getBoundingClientRect().bottom - document.querySelector(".app-main").getBoundingClientRect().bottom);
      if (approvalOverflow > 0) throw new Error(`Approval primary action is ${Math.round(approvalOverflow)}px below the viewport`);
    }
    if (await page.getByRole("button", { name: "อนุมัติการทดลองจำลอง" }).isEnabled()) throw new Error("Approval bypassed consent");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) throw new Error(`Horizontal overflow at ${width}px`);
    if (errors.length) throw new Error(`${width}px browser errors: ${errors.join("; ")}`);
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base + "/opportunity", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /ตรวจทานก่อนทดลอง Bundle/ }).click();
  await page.getByRole("heading", { name: "ตรวจทานอย่างรวดเร็ว" }).waitFor();
  console.log("Strategy verified: mobile widths, optional exploration, direct Quick Review, consent gate.");
  await page.close();
} finally { await browser.close(); }
