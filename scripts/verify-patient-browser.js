import "dotenv/config";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";
import axe from "axe-core";
import { chromium } from "playwright-core";

import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/config/env.mjs";
import { getLocalDateOnly } from "@/lib/patient-validation";

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
const suffix = randomBytes(6).toString("hex");
const normalizedMrn = `BROWSER-${suffix}`.toUpperCase();
const duplicateMrn = `BROWSER-DUP-${suffix}`.toUpperCase();
const patientIds = [];

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

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

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
    await login(page);

    await page
      .getByRole("button", { name: "Arabic", exact: true })
      .press("Space");
    await page.waitForFunction(() => document.documentElement.lang === "ar");
    await page
      .getByRole("button", { name: "داكن", exact: true })
      .press("Enter");
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );

    await page.goto("/patients");
    assert.equal(
      await page
        .getByRole("link", { name: "المرضى", exact: true })
        .first()
        .getAttribute("aria-current"),
      "page",
    );
    assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
    await assertNoSeriousAccessibilityViolations(page);

    await page.setViewportSize({ width: 375, height: 812 });
    await assertNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.getByRole("link", { name: "مريض جديد" }).click();
    await page.waitForURL(`${BASE_URL}/patients/new`);
    assert.equal(
      await page.getByRole("heading", { name: "إنشاء مريض" }).isVisible(),
      true,
    );

    await page.locator("#mrn").fill(` ${normalizedMrn.toLowerCase()} `);
    await page.locator("#firstName").fill("Browser");
    await page.locator("#lastName").fill("Verification");
    await page.locator("#dateOfBirth").fill("9999-12-31");
    await page.locator("#sex").selectOption("UNKNOWN");
    await page.locator("#email").fill(" Browser.Patient@Example.TEST ");
    await page.locator("#phone").fill("+961 70 000 001");
    await page.getByRole("button", { name: "حفظ المريض" }).click();

    assert.equal(
      await page.locator("#dateOfBirth").getAttribute("aria-invalid"),
      "true",
    );
    assert.equal(
      await page
        .getByText("لا يمكن أن يكون تاريخ الميلاد في المستقبل.")
        .isVisible(),
      true,
    );
    assert.equal(
      await page
        .locator("#dateOfBirth")
        .evaluate((element) => element === document.activeElement),
      true,
    );

    await page.locator("#dateOfBirth").fill(getLocalDateOnly());
    await page.getByRole("button", { name: "حفظ المريض" }).click();
    await page.waitForURL(/\/patients\/[0-9a-f-]+$/);
    const patientId = page.url().split("/").at(-1);
    patientIds.push(patientId);

    assert.equal(await page.getByText(normalizedMrn).isVisible(), true);
    assert.equal(
      await page.getByText("browser.patient@example.test").isVisible(),
      true,
    );
    await assertNoSeriousAccessibilityViolations(page);

    await page.getByRole("link", { name: "تعديل المريض" }).click();
    await page.waitForURL(`${BASE_URL}/patients/${patientId}/edit`);
    await page.locator("#firstName").fill("Updated Browser");
    await page.locator("#email").fill(" Updated.Browser@Example.TEST ");
    await page.getByRole("button", { name: "حفظ المريض" }).click();
    await page.waitForURL(`${BASE_URL}/patients/${patientId}`);
    assert.equal(await page.getByText(/Updated Browser/).isVisible(), true);
    assert.equal(
      await page.getByText("updated.browser@example.test").isVisible(),
      true,
    );

    const duplicateResponse = await page.request.post("/api/private/patients", {
      data: {
        mrn: duplicateMrn,
        firstName: "Duplicate",
        lastName: "Target",
        dateOfBirth: "2000-01-01",
        sex: "UNKNOWN",
        email: null,
        phone: null,
      },
    });
    assert.equal(duplicateResponse.status(), 201);
    patientIds.push((await duplicateResponse.json()).patient.id);

    await page.getByRole("link", { name: "تعديل المريض" }).click();
    await page.locator("#mrn").fill(` ${duplicateMrn.toLowerCase()} `);
    await page.getByRole("button", { name: "حفظ المريض" }).click();
    await page.locator("#mrn-error").waitFor({ state: "visible" });
    assert.equal(
      await page.getByText("يوجد مريض يحمل رقم السجل الطبي هذا.").isVisible(),
      true,
    );
    assert.equal(await page.locator("#mrn").inputValue(), duplicateMrn);
    assert.equal(
      await page
        .locator("#mrn")
        .evaluate((element) => element === document.activeElement),
      true,
    );

    await page.goto(`/patients/${patientId}`);
    const archiveTrigger = page.getByRole("button", {
      name: "أرشفة المريض",
      exact: true,
    });
    await archiveTrigger.focus();
    await archiveTrigger.press("Enter");
    const dialog = page.getByRole("dialog");
    assert.equal(await dialog.isVisible(), true);
    await assertNoSeriousAccessibilityViolations(page);
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => document.activeElement?.textContent?.trim() === "أرشفة المريض",
    );

    await archiveTrigger.press("Space");
    await dialog
      .getByRole("button", { name: "أرشفة المريض", exact: true })
      .click();
    await page.waitForURL(`${BASE_URL}/patients`);
    assert.equal(
      await page.getByText("Updated Browser", { exact: false }).count(),
      0,
    );

    await page.setViewportSize({ width: 375, height: 812 });
    await assertNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.getByRole("button", { name: "فاتح", exact: true }).click();
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "light",
    );
    await page.getByRole("button", { name: "الإنجليزية", exact: true }).click();
    await page.waitForFunction(() => document.documentElement.lang === "en");
    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForURL(`${BASE_URL}/login`);

    console.log(
      "Patient browser, keyboard, RTL, theme, and accessibility verification passed.",
    );
  } finally {
    await page.request.post("/api/auth/logout").catch(() => {});

    if (patientIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { entityType: "PATIENT", entityId: { in: patientIds } },
      });
      await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
    }

    await context.close();
    await browser.close();
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
