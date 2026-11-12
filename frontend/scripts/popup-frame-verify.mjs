import { chromium } from "playwright";
import { resolve } from "node:path";

const base = process.env.GRABSPARK_PREVIEW_URL ?? "http://127.0.0.1:3001";
const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of [{ width: 1072, height: 1756 }, ...[320, 375, 390, 430].map(width => ({ width, height: 844 }))]) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${base}/?oneclick=1`, { waitUntil: "networkidle" });
    await page.getByRole("dialog").waitFor();
    const frame = await page.locator(".phone-frame").boundingBox();
    const layer = await page.locator(".opportunity-popup-layer").boundingBox();
    const dialog = await page.getByRole("dialog").boundingBox();
    if (!frame || !layer || !dialog) throw new Error("Recommendation frame is missing");
    if (Math.abs(frame.x - layer.x) > 2 || Math.abs(frame.width - layer.width) > 2 || Math.abs(frame.y + frame.height - dialog.y - dialog.height) > 2) {
      throw new Error(`${viewport.width}px: Recommendation popup is not anchored to the app frame`);
    }
    if (dialog.height > frame.height || dialog.y < frame.y) throw new Error(`${viewport.width}px: popup exceeds the app frame`);
    if (viewport.width <= 430) {
      const controls = await page.getByRole('dialog').locator('.strategy-sheet-footer').evaluate(footer => {
        const elements = [...footer.querySelectorAll('input[type="checkbox"], .primary-button')];
        return elements.map(element => {
          const box = element.getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
        });
      });
      if (controls.length !== 3 || controls.some(box => box.left < 0 || box.right > viewport.width || box.top < 0 || box.bottom > viewport.height)) throw new Error(`${viewport.width}px: consent or approval control is clipped`);
      if (await page.locator('.strategy-sheet-body').evaluate(element => element.scrollWidth > element.clientWidth)) throw new Error(`${viewport.width}px: popup has horizontal overflow`);
      const clippedFigures = await page.locator('.strategy-sheet-card-metric strong').evaluateAll(elements => elements.some(element => element.scrollWidth > element.clientWidth + 1));
      if (clippedFigures) throw new Error(`${viewport.width}px: financial figure is clipped`);
      const overlappingLabels = await page.locator('.strategy-sheet-card').evaluateAll(cards => cards.some(card => {
        const copy = card.querySelector('.strategy-sheet-card-copy');
        const metric = card.querySelector('.strategy-sheet-card-metric');
        return copy && metric && (copy.scrollWidth > copy.clientWidth + 1 || copy.getBoundingClientRect().right > metric.getBoundingClientRect().left + 1);
      }));
      if (overlappingLabels) throw new Error(`${viewport.width}px: strategy labels overlap the financial column`);
      const bodyActions = await page.locator('.strategy-sheet-body-actions button').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
      if (bodyActions.length !== 2 || bodyActions.some(height => height < 44)) throw new Error(`${viewport.width}px: secondary action touch target is too small`);
      await page.locator('.strategy-sheet-card').last().evaluate(element => element.scrollIntoView({ block: 'end' }));
      const lastCardBottom = await page.locator('.strategy-sheet-card').last().evaluate(element => element.getBoundingClientRect().bottom);
      const footerTop = await page.locator('.strategy-sheet-footer').evaluate(element => element.getBoundingClientRect().top);
      if (lastCardBottom > footerTop + 1) throw new Error(`${viewport.width}px: sticky footer obscures the last strategy`);
      await page.locator('.strategy-sheet-body').evaluate(element => element.scrollTo(0, 0));
    }
    if (viewport.width === 1072) await page.screenshot({ path: resolve("../docs/screenshots/strategy/popup-framed-desktop.png"), fullPage: true });
    if (viewport.width === 390) await page.screenshot({ path: resolve("../docs/screenshots/strategy/popup-framed-mobile-390.png") });
    await page.close();
  }
  console.log("Recommendation popup, consent footer, and figures fit desktop and 320/375/390/430 px mobile widths.");
} finally {
  await browser.close();
}
