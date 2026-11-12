import { chromium } from "playwright";
import { resolve } from "node:path";

const base = "http://127.0.0.1:3001";
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "networkidle" });
    const dialog = page.getByRole("dialog", { name: "พบโอกาสใหม่สำหรับร้าน" });
    await dialog.waitFor();
    if (width === 390) await page.screenshot({ path: resolve("../docs/screenshots/strategy/home-popup-390.png") });
    await page.getByRole("button", { name: "ปิดคำแนะนำ One Click" }).click();
    await dialog.waitFor({ state: "hidden" });
    await page.locator(".home-recommendation").waitFor();
    await page.reload({ waitUntil: "networkidle" });
    if (await dialog.count()) throw new Error(`Dismissed popup returned at ${width}px`);
    await page.locator(".home-recommendation-link").click();
    await page.getByRole("heading", { name: "Guided Missions" }).waitFor();
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: /ดูคำแนะนำ One Click/ }).click();
  await page.getByRole("heading", { name: "Guided Missions" }).waitFor();
  console.log("Home popup verified: first appearance, dismissal to Home recommendation, session persistence, and CTA navigation.");
  await context.close();
} finally { await browser.close(); }
