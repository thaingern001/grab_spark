import { chromium } from "playwright";

const base = "http://127.0.0.1:3001";
const browser = await chromium.launch({ headless: true });
try {
  const [first, second] = await Promise.all([browser.newPage(), browser.newPage()]);
  for (const page of [first, second]) {
    await page.goto(base + "/opportunity", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /ตรวจทานก่อนทดลอง Bundle/ }).click();
    await page.getByRole("button", { name: "ตรวจหรือแก้ต้นทุน" }).click();
  }
  const firstFood = first.getByRole("textbox", { name: "ชุดที่เสนอ ต้นทุนอาหาร" });
  const secondFood = second.getByRole("textbox", { name: "ชุดที่เสนอ ต้นทุนอาหาร" });
  await firstFood.fill("41.00");
  await first.getByRole("button", { name: "บันทึกและคำนวณใหม่" }).click();
  await first.getByText(/QUICK REVIEW · รุ่นข้อมูล 2/).waitFor();
  await first.getByText("฿23.30").first().waitFor();
  await secondFood.fill("42.00");
  await second.getByRole("button", { name: "บันทึกและคำนวณใหม่" }).click();
  await second.getByRole("alert").getByText(/เปลี่ยนแปลงจากอีกหน้าต่าง/).waitFor();
  if (await secondFood.inputValue() !== "41.00") throw new Error("Latest authoritative cost was not loaded after conflict");
  console.log("Stale revision verified: backend recalculation, revision 2, conflict message and refreshed input.");
} finally { await browser.close(); }
