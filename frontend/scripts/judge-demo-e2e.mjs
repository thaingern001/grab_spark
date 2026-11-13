import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const base = process.env.JUDGE_DEMO_URL ?? "http://127.0.0.1:3002";
const shots = fileURLToPath(new URL("../../docs/screenshots/judge-demo/", import.meta.url));
const browser = await chromium.launch({ headless: true });
const expected = {
  Bundle: { contribution: "฿956.00", difference: "+฿304.00", risk: "25/100" },
  Discount: { contribution: "฿715.00", difference: "+฿63.00", risk: "29/100" },
  Advertising: { contribution: "฿747.60", difference: "+฿95.60", risk: "35/100" },
};
const problems = [];
let capturedIntro = false;
await mkdir(shots, { recursive: true });

async function setup(width = 390, height = 844) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on("pageerror", error => problems.push(error.message));
  page.on("console", message => { if (message.type() === "error") problems.push(message.text()); });
  page.on("request", request => { if (/127\.0\.0\.1:8000|localhost:8000|\/api\/merchant/.test(request.url())) problems.push(`Backend request: ${request.url()}`); });
  await page.goto(base);
  const intro = page.getByRole("dialog", { name: "One Click recommendation" });
  await intro.waitFor();
  if (width === 390 && !capturedIntro) { await page.screenshot({ path: `${shots}/00a-judge-first-open.png` }); capturedIntro = true; }
  await intro.getByRole("button", { name: "Merchant Home" }).click();
  await intro.waitFor({ state: "hidden" });
  await page.getByRole("heading", { name: "For your store" }).waitFor();
  check(await intro.count() === 0, "Recommendation did not dismiss into Home");
  check(await page.locator(".home-recommendation.is-opportunity").count() === 1, "Highlighted One Click card missing");
  check(await page.locator(".judge-bottom-nav button").count() === 5, "Five-icon merchant footer missing");
  return { page, context };
}

function check(condition, message) { if (!condition) throw new Error(message); }
async function noOverflow(page, label) {
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  check(!wide, `${label}: horizontal overflow`);
}

try {
  for (const [name, data] of Object.entries(expected)) {
    const { page, context } = await setup();
    check(await page.getByRole("heading", { name: "Manage your store" }).count() === 1, "Merchant operations missing from Home");
    check(await page.getByRole("heading", { name: "Popular items" }).count() === 1, "Menu summary missing from Home");
    if (name === "Bundle") {
      const footer = page.getByRole("navigation", { name: "Merchant navigation" });
      await footer.getByRole("button", { name: "Orders" }).click();
      check(await footer.getByRole("button", { name: "Orders" }).getAttribute("class") === "is-current", "Orders footer tab did not activate");
      await footer.getByRole("button", { name: "Menu" }).click();
      check(await footer.getByRole("button", { name: "Menu" }).getAttribute("class") === "is-current", "Menu footer tab did not activate");
      await footer.getByRole("button", { name: "Insights" }).click();
      check(await footer.getByRole("button", { name: "Insights" }).getAttribute("class") === "is-current", "Insights footer tab did not activate");
      await footer.getByRole("button", { name: "Home" }).click();
      await page.reload();
      const reopened = page.getByRole("dialog", { name: "One Click recommendation" });
      await reopened.waitFor();
      await reopened.getByRole("button", { name: "Merchant Home" }).click();
      await page.screenshot({ path: `${shots}/00-merchant-home.png` });
    }

    await page.getByRole("button", { name: "View recommendation" }).click({ position: { x: 20, y: 110 } });
    await page.getByRole("heading", { name: "Recommended: Bundle" }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll(".judge-strategy-card img")].every(image => image.complete && image.naturalWidth > 0));
    if (name === "Bundle") await page.screenshot({ path: `${shots}/01-c1-recommendation.png` });
    await page.getByRole("button", { name: `View ${name} details` }).click();
    await page.getByRole("heading", { name, exact: true }).waitFor();
    await page.getByRole("heading", { name: "Financial breakdown" }).waitFor();
    check(await page.getByText("Food cost per strategy order").count() === 1, `${name} cost detail missing`);
    if (name === "Bundle") {
      await page.screenshot({ path: `${shots}/02b-c1-strategy-detail.png` });
      await page.locator(".judge-main").evaluate(element => { element.scrollTop = 900; });
      await page.screenshot({ path: `${shots}/02c-c1-financial-breakdown.png` });
    }
    await page.getByRole("button", { name: /Return to selection/ }).click();
    check(await page.getByRole("button", { name: /Confirm Bundle and view simulated result/ }).count() === 1, "Details changed selection");
    await page.getByRole("button", { name: new RegExp(`Select ${name} strategy`) }).click();
    await page.getByRole("button", { name: new RegExp(`Confirm ${name} and view simulated result`) }).waitFor();
    if (name !== "Bundle") check(await page.getByText("AI recommended · Lowest modeled risk").count() === 1, "Recommendation badge lost");
    await page.getByRole("button", { name: "Compare details" }).click();
    await page.getByRole("heading", { name: "Compare strategies" }).waitFor();
    if (name === "Bundle") await page.screenshot({ path: `${shots}/02-c1-comparison.png` });
    await page.getByRole("button", { name: /Back to selection and approval/ }).click();
    const approve = page.getByRole("button", { name: new RegExp(`Confirm ${name} and view simulated result`) });
    check(await approve.isDisabled(), "Approval enabled before consent");
    await page.getByRole("checkbox", { name: /I reviewed the prices/ }).check();
    check(await approve.isDisabled(), "Approval enabled with only one consent");
    await page.getByRole("checkbox", { name: /I understand this is a simulation/ }).check();
    check(await approve.isEnabled(), "Approval disabled after both consents");
    if (name === "Bundle") await page.screenshot({ path: `${shots}/03-c1-approval-ready.png` });
    await approve.click();
    await page.getByRole("heading", { name: "7-day simulated result" }).waitFor();
    check(await page.getByRole("heading", { name: "Day 1 pending" }).count() === 1, "Actual trial status missing");
    check((await page.locator(".actual-progress").innerText()).includes("0 of 7 live days completed"), "Live status falsely advanced");
    check((await page.locator(".results-hero").innerText()).includes(data.contribution), `${name} result contribution`);
    check((await page.locator(".results-hero").innerText()).includes(data.difference), `${name} result difference`);
    check((await page.locator(".results-hero").innerText()).includes(data.risk), `${name} risk`);
    if (name === "Bundle") await page.screenshot({ path: `${shots}/04-c1-results.png` });
    await page.getByRole("button", { name: "Open mission chat" }).click();
    await page.getByRole("heading", { name: `${name} mission chat` }).waitFor();
    await page.getByRole("textbox", { name: "Message MAI about this mission" }).fill("What is the actual status?");
    await page.getByRole("button", { name: "Send message" }).click();
    await page.getByText(/0 live days completed/).waitFor();
    if (name === "Bundle") await page.screenshot({ path: `${shots}/04b-c1-mission-agent.png` });
    await page.getByRole("button", { name: "Simulated result" }).click();
    await page.getByRole("button", { name: /Mark result as reviewed/ }).click();
    await page.reload();
    await page.getByText("Result reviewed", { exact: true }).waitFor();
    if (name === "Bundle") await page.screenshot({ path: `${shots}/05-c1-reviewed.png` });
    await noOverflow(page, `${name} result`);
    await page.getByRole("button", { name: "Reset demo" }).click();
    await page.getByRole("dialog", { name: "One Click recommendation" }).waitFor();
    await page.getByRole("dialog", { name: "One Click recommendation" }).getByRole("button", { name: "Merchant Home" }).click();
    await page.getByRole("heading", { name: "For your store" }).waitFor();

    await page.getByRole("button", { name: "View recommendation" }).waitFor();
    await context.close();
  }

  const { page, context } = await setup();
  await page.getByRole("button", { name: "Quick actions" }).click();
  await page.getByRole("navigation", { name: "Quick actions" }).getByRole("button", { name: "Connector" }).click();
  await page.getByRole("heading", { name: "AI Connections" }).waitFor();
  check(await page.getByRole("button", { name: /Authorize simulated connection/ }).isDisabled(), "Authorize allowed no client/scopes");
  await page.getByRole("button", { name: /ChatGPT.*Concept option/ }).click();
  check(await page.getByRole("button", { name: /Authorize simulated connection/ }).isDisabled(), "Authorize allowed without scopes");
  await page.getByRole("checkbox", { name: /Sales Data — Read/ }).check();
  await page.screenshot({ path: `${shots}/06-c2-permissions.png` });
  await page.getByRole("button", { name: /Authorize simulated connection/ }).click();
  await page.getByText("Connected — Simulated", { exact: true }).waitFor();
  await page.getByRole("button", { name: /Open simulated AI workspace/ }).click();
  check(await page.locator(".ai-provider-chatgpt").count() === 1, "ChatGPT workspace theme missing");
  check(await page.locator(".judge-header").count() === 0, "Merchant shell remained inside AI workspace");
  await page.screenshot({ path: `${shots}/11-c2-chatgpt-welcome.png` });
  await page.getByRole("button", { name: /Ask simulated AI/ }).click();
  check((await page.locator(".judge-tool-list").innerText()).includes("Permission required"), "Restricted tool not blocked");
  check(await page.getByRole("heading", { name: "Top menu performance · synthetic" }).count() === 0, "Menu data exposed without permission");
  check(await page.locator(".judge-draft").count() === 0, "Draft appeared without menu permission");
  await page.screenshot({ path: `${shots}/07-c2-workspace-limited.png` });
  await page.getByRole("button", { name: "Review permissions" }).click();
  await page.getByRole("checkbox", { name: /Menu Performance — Read/ }).check();
  await page.getByRole("button", { name: /Open simulated AI workspace/ }).click();
  await page.getByRole("button", { name: /Ask simulated AI/ }).click();
  check(await page.getByRole("heading", { name: "Top menu performance · synthetic" }).count() === 0, "Unchecked authorization granted new scope");
  await page.getByRole("button", { name: "AI Connections" }).click();
  await page.getByRole("button", { name: /Update authorized permissions/ }).click();
  await page.getByRole("button", { name: /Open simulated AI workspace/ }).click();
  await page.getByRole("button", { name: /Ask simulated AI/ }).click();
  await page.getByRole("heading", { name: "Top menu performance · synthetic" }).waitFor();
  await page.getByRole("heading", { name: "Prepare a meal-and-drink offer" }).waitFor();
  await page.locator(".judge-draft").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${shots}/08-c2-workspace-draft.png` });
  await page.getByRole("button", { name: "Review and confirm concept only" }).click();
  await page.getByText("Concept approval recorded — no real campaign launched.").waitFor();
  await page.screenshot({ path: `${shots}/09-c2-concept-reviewed.png` });
  await page.reload();
  await page.getByText("Concept approval recorded — no real campaign launched.").waitFor();
  await page.getByRole("button", { name: "AI Connections" }).click();
  await page.getByRole("checkbox", { name: /Sales Data — Read/ }).uncheck();
  await page.getByRole("button", { name: /Open simulated AI workspace/ }).click();
  check(await page.getByRole("heading", { name: "Sales summary · synthetic" }).count() === 0, "Removed permission still exposes sales");
  check(await page.locator(".judge-draft").count() === 0, "Draft remained after required permission removal");
  await page.getByRole("button", { name: "Revoke access" }).click();
  await page.getByText("Access Revoked", { exact: true }).waitFor();
  await page.screenshot({ path: `${shots}/10-c2-access-revoked.png` });
  await page.getByRole("button", { name: /Claude.*Concept option/ }).click();
  await page.getByRole("checkbox", { name: /Menu Performance — Read/ }).check();
  await page.getByRole("button", { name: /Authorize simulated connection/ }).click();
  await page.getByRole("button", { name: /Open simulated AI workspace/ }).click();
  check(await page.locator(".ai-provider-claude").count() === 1, "Claude workspace theme missing");
  await page.screenshot({ path: `${shots}/12-c2-claude-workspace.png` });
  await page.getByRole("button", { name: /Ask simulated AI/ }).click();
  check(await page.getByRole("heading", { name: "Sales summary · synthetic" }).count() === 0, "Revoked sales data exposed");
  await page.getByRole("button", { name: "AI Connections" }).click();
  await page.getByRole("button", { name: /Other.*Concept option/ }).click();
  check(await page.getByRole("button", { name: /Other.*Concept option/ }).getAttribute("aria-pressed") === "true", "Other client not selected");
  await page.getByRole("button", { name: /Authorize simulated connection/ }).click();
  await page.getByRole("button", { name: /Open simulated AI workspace/ }).click();
  check(await page.locator(".ai-provider-other").count() === 1, "Other workspace theme missing");
  await page.getByRole("textbox", { name: "Message Other (simulation)" }).fill("Can you show a made up forecast?");
  await page.getByRole("textbox", { name: "Message Other (simulation)" }).press("Enter");
  await page.locator(".ai-user-bubble").getByText("Can you show a made up forecast?").waitFor();
  await page.getByText(/cannot generate a tailored AI reply/).waitFor();
  check(await page.locator(".judge-draft").count() === 0, "Custom prompt generated prepared campaign draft");
  await page.reload();
  await page.locator(".ai-user-bubble").getByText("Can you show a made up forecast?").waitFor();
  await page.getByRole("button", { name: "Reset demo" }).click();
  await page.getByRole("dialog", { name: "One Click recommendation" }).waitFor();
  await page.getByRole("dialog", { name: "One Click recommendation" }).getByRole("button", { name: "Merchant Home" }).click();
  await page.getByRole("button", { name: "Quick actions" }).click();
  await page.getByRole("navigation", { name: "Quick actions" }).getByRole("button", { name: "Connector" }).click();
  check(await page.getByText("Not Connected", { exact: true }).count() === 1, "Reset retained connection");
  check(await page.getByRole("checkbox", { checked: true }).count() === 0, "Reset retained permissions");
  await context.close();

  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    const { page, context } = await setup(width);
    await noOverflow(page, `${width}px landing`);

    await page.getByRole("button", { name: "View recommendation" }).click();
    await noOverflow(page, `${width}px recommendation`);
    const clipped = await page.locator(".judge-strategy-figure").evaluateAll(figures => figures.some(figure => {
      const amount = figure.querySelector("strong");
      return !amount || amount.scrollWidth > amount.clientWidth + 1 || amount.getBoundingClientRect().right > figure.getBoundingClientRect().right + 1;
    }));
    check(!clipped, `${width}px financial figure clipped`);
    await page.getByRole("button", { name: "Compare details" }).click();
    await noOverflow(page, `${width}px comparison`);
    await page.getByRole("button", { name: /Back to selection and approval/ }).click();
    await page.getByRole("button", { name: /View Advertising details/ }).click();
    await noOverflow(page, `${width}px details`);
    await page.getByRole("button", { name: /Return to selection/ }).click();
    const footerFits = await page.locator(".judge-approval-footer").evaluate(footer => footer.getBoundingClientRect().bottom <= innerHeight + 1);
    check(footerFits, `${width}px consent footer clipped`);
    await page.getByRole("checkbox", { name: /I reviewed the prices/ }).check();
    await page.getByRole("checkbox", { name: /I understand this is a simulation/ }).check();
    await page.getByRole("button", { name: /Confirm Bundle and view simulated result/ }).click();
    await noOverflow(page, `${width}px results`);
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await page.getByRole("button", { name: "Quick actions" }).click();
    await page.getByRole("navigation", { name: "Quick actions" }).getByRole("button", { name: "Connector" }).click();
    await noOverflow(page, `${width}px connections`);
    check(await page.locator(".judge-client-options button").count() === 3, `${width}px client options missing`);
    await page.getByRole("button", { name: /ChatGPT.*Concept option/ }).click();
    await page.getByRole("checkbox", { name: /Sales Data — Read/ }).check();
    await page.getByRole("checkbox", { name: /Menu Performance — Read/ }).check();
    await page.getByRole("button", { name: /Authorize simulated connection/ }).click();
    await page.getByRole("button", { name: /Open simulated AI workspace/ }).click();
    await page.getByRole("button", { name: /Ask simulated AI/ }).click();
    await noOverflow(page, `${width}px workspace`);
    const composerFits = await page.locator(".ai-chat-composer").evaluate(composer => composer.getBoundingClientRect().bottom <= innerHeight + 1);
    check(composerFits, `${width}px workspace composer clipped`);
    await context.close();
  }
  check(problems.length === 0, `Browser errors: ${problems.join(" | ")}`);
  console.log("Judge demo: 3 C1 strategies, consent, results, review, 3 themed C2 chat workspaces, permissions/draft/revoke, 7 widths, no backend requests or browser errors passed.");
} finally { await browser.close(); }
