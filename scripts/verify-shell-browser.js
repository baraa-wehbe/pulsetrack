import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import axe from "axe-core";
import { chromium } from "playwright-core";

const BASE_URL = "http://localhost:3000";
const email = process.env.PULSETRACK_E2E_EMAIL;
const password = process.env.PULSETRACK_E2E_PASSWORD;
const browserCandidates = [
  process.env.PULSETRACK_BROWSER_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);
const executablePath = browserCandidates.find((candidate) =>
  existsSync(candidate),
);

if (!email || !password) {
  throw new Error(
    "PULSETRACK_E2E_EMAIL and PULSETRACK_E2E_PASSWORD are required.",
  );
}

if (!executablePath) {
  throw new Error(
    "No supported local browser was found. Set PULSETRACK_BROWSER_PATH.",
  );
}

const assertDocumentState = async (page, { direction, language, theme }) => {
  const state = await page.locator("html").evaluate((element) => ({
    direction: element.dir,
    language: element.lang,
    theme: element.dataset.theme,
    darkClass: element.classList.contains("dark"),
  }));

  assert.deepEqual(state, {
    direction,
    language,
    theme,
    darkClass: theme === "dark",
  });
};

const assertNoSeriousAccessibilityViolations = async (page) => {
  await page.addScriptTag({ content: axe.source });
  const results = await page.evaluate(async () => globalThis.axe.run(document));
  const violations = results.violations.filter(({ impact }) =>
    ["critical", "serious"].includes(impact),
  );

  assert.deepEqual(
    violations.map(({ id, impact }) => ({ id, impact })),
    [],
  );
};

const assertNoHorizontalOverflow = async (page) => {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  assert.ok(dimensions.scrollWidth <= dimensions.clientWidth);
};

const login = async (page) => {
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`${BASE_URL}/`);
};

const main = async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    await page.goto("/login");
    await assertDocumentState(page, {
      direction: "ltr",
      language: "en",
      theme: "light",
    });
    assert.equal(await page.locator("header").count(), 0);
    await assertNoSeriousAccessibilityViolations(page);

    await login(page);
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(
        () => document.activeElement?.getAttribute("href") === "#main-content",
      ),
      true,
    );
    await page.keyboard.press("Enter");
    assert.equal(
      await page
        .locator("#main-content")
        .evaluate((element) => element === document.activeElement),
      true,
    );

    const dashboardTrigger = page.locator(
      'button[aria-label="Open dashboard menu"]',
    );
    await dashboardTrigger.focus();
    await page.keyboard.press("Enter");
    assert.equal(await dashboardTrigger.getAttribute("aria-expanded"), "true");
    await page.keyboard.press("ArrowDown");
    assert.ok(
      await page
        .getByRole("menuitem", { name: "Patient Dashboard" })
        .isVisible(),
    );
    await page.keyboard.press("Escape");
    assert.equal(await dashboardTrigger.getAttribute("aria-expanded"), "false");
    await page.waitForFunction(
      () =>
        document.activeElement?.getAttribute("aria-label") ===
        "Open dashboard menu",
    );
    assert.equal(
      await dashboardTrigger.evaluate(
        (element) => element === document.activeElement,
      ),
      true,
    );

    await page.getByRole("link", { name: "Patients", exact: true }).click();
    await page.waitForURL(`${BASE_URL}/patients`);
    assert.equal(
      await page
        .getByRole("link", { name: "Patients", exact: true })
        .getAttribute("aria-current"),
      "page",
    );

    for (const viewport of [
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await assertNoHorizontalOverflow(page);
    }

    const mobileTrigger = page.getByRole("button", {
      name: "Open navigation",
    });
    await mobileTrigger.focus();
    await page.keyboard.press("Enter");
    const mobileDialog = page.getByRole("dialog");
    assert.equal(await mobileDialog.isVisible(), true);
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await mobileDialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
      true,
    );
    assert.equal(
      await mobileDialog
        .getByRole("link", { name: "Clinic Dashboard" })
        .isVisible(),
      true,
    );
    await page.keyboard.press("Escape");
    assert.equal(await mobileDialog.count(), 0);
    assert.equal(
      await mobileTrigger.evaluate(
        (element) => element === document.activeElement,
      ),
      true,
    );

    await mobileTrigger.press("Space");
    await mobileDialog
      .getByRole("link", { name: "Lab Uploads", exact: true })
      .click();
    await page.waitForURL(`${BASE_URL}/lab-uploads`);
    assert.equal(await mobileDialog.count(), 0);

    await page.setViewportSize({ width: 1440, height: 900 });
    const arabicButton = page.getByRole("button", {
      name: "Arabic",
      exact: true,
    });
    await arabicButton.focus();
    await arabicButton.press("Space");
    await page.waitForFunction(() => document.documentElement.lang === "ar");
    await assertDocumentState(page, {
      direction: "rtl",
      language: "ar",
      theme: "light",
    });

    await page.goto("/dashboard/patient");
    await assertDocumentState(page, {
      direction: "rtl",
      language: "ar",
      theme: "light",
    });
    assert.equal(
      await page
        .getByRole("heading", { name: "لوحة متابعة المريض" })
        .isVisible(),
      true,
    );

    await page.getByRole("button", { name: "داكن", exact: true }).click();
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );
    await page.reload();
    await assertDocumentState(page, {
      direction: "rtl",
      language: "ar",
      theme: "dark",
    });
    await assertNoHorizontalOverflow(page);
    await assertNoSeriousAccessibilityViolations(page);

    await page.getByRole("button", { name: "تسجيل الخروج" }).click();
    await page.waitForURL(`${BASE_URL}/login`);
    await assertDocumentState(page, {
      direction: "rtl",
      language: "ar",
      theme: "dark",
    });
    assert.equal(await page.locator("header").count(), 0);

    await login(page);
    await assertDocumentState(page, {
      direction: "rtl",
      language: "ar",
      theme: "dark",
    });

    await page.getByRole("button", { name: "فاتح", exact: true }).click();
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "light",
    );
    await page.getByRole("button", { name: "الإنجليزية", exact: true }).click();
    await page.waitForFunction(() => document.documentElement.lang === "en");
    await assertDocumentState(page, {
      direction: "ltr",
      language: "en",
      theme: "light",
    });

    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForURL(`${BASE_URL}/login`);

    console.log(
      "Application shell browser and accessibility verification passed.",
    );
  } finally {
    await page.request.post("/api/auth/logout").catch(() => {});
    await context.close();
    await browser.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
