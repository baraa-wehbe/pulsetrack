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
    await page
      .getByRole("heading", { name: "إنشاء مريض" })
      .waitFor({ state: "visible" });

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
    await page.waitForURL(new RegExp(`${BASE_URL}/patients/[0-9a-f-]{36}$`));
    const storedPatient = await prisma.patient.findUnique({
      where: { mrn: normalizedMrn },
      select: { id: true },
    });
    assert.ok(storedPatient);
    const patientId = new URL(page.url()).pathname.split("/").at(-1);
    assert.equal(patientId, storedPatient.id);
    patientIds.push(patientId);

    assert.equal(await page.getByText(normalizedMrn).first().isVisible(), true);
    assert.equal(
      await page.getByText("browser.patient@example.test").isVisible(),
      true,
    );
    await page
      .getByRole("heading", { name: "لا توجد تقييمات بعد" })
      .waitFor({ state: "visible" });
    assert.equal(
      await page.getByText("ستتوفر بيانات التحاليل في مهمة لاحقة.").count(),
      3,
    );
    await assertNoSeriousAccessibilityViolations(page);

    const questionnaire = await prisma.questionnaire.findUnique({
      where: {
        code_version: {
          code: "dsma-8",
          version: "1.0",
        },
      },
      select: { id: true },
    });
    assert.ok(questionnaire);
    const sensitiveTokenHash = randomBytes(32).toString("hex");
    await prisma.assessment.create({
      data: {
        patientId,
        questionnaireId: questionnaire.id,
        createdById: (
          await prisma.clinician.findUnique({
            where: { email },
            select: { id: true },
          })
        ).id,
        status: "COMPLETED",
        recipientEmail: "detail-browser@example.test",
        scheduledFor: new Date("2026-07-20T08:00:00.000Z"),
        tokenHash: sensitiveTokenHash,
        sentAt: new Date("2026-07-20T08:05:00.000Z"),
        expiresAt: new Date("2026-07-27T08:05:00.000Z"),
        completedAt: new Date("2026-07-20T09:00:00.000Z"),
        tokenConsumedAt: new Date("2026-07-20T09:00:00.000Z"),
        createdAt: new Date("2026-07-20T08:00:00.000Z"),
        response: {
          create: {
            answers: {},
            totalScore: 15,
            riskBand: "HIGH",
            scoringSnapshot: {},
            submittedAt: new Date("2026-07-20T09:00:00.000Z"),
          },
        },
      },
    });
    await prisma.assessment.create({
      data: {
        patientId,
        questionnaireId: questionnaire.id,
        createdById: (
          await prisma.clinician.findUnique({
            where: { email },
            select: { id: true },
          })
        ).id,
        status: "SCHEDULED",
        recipientEmail: "detail-browser@example.test",
        scheduledFor: new Date("2026-07-24T08:00:00.000Z"),
        createdAt: new Date("2026-07-24T08:00:00.000Z"),
      },
    });
    await page.reload();
    const assessmentItems = page.locator(
      '[aria-labelledby="assessment-history-heading"] ol > li',
    );
    assert.equal(await assessmentItems.count(), 2);
    assert.match(await assessmentItems.first().textContent(), /مجدول/);
    assert.match(await assessmentItems.nth(1).textContent(), /15\s*\/\s*24/);
    assert.match(await assessmentItems.nth(1).textContent(), /خطورة مرتفعة/);
    const detailHtml = await page.content();
    assert.equal(new URL(page.url()).pathname.includes(normalizedMrn), false);
    assert.equal(detailHtml.includes(sensitiveTokenHash), false);
    assert.equal(detailHtml.includes("detail-browser@example.test"), false);

    for (let index = 0; index < 11; index += 1) {
      const response = await page.request.post("/api/private/patients", {
        data: {
          mrn: `PAGE-${suffix}-${String(index).padStart(2, "0")}`.toUpperCase(),
          firstName: `Page ${index}`,
          lastName: "Verification",
          dateOfBirth: "2000-01-01",
          sex: "UNKNOWN",
          email: null,
          phone: null,
        },
      });
      assert.equal(response.status(), 201);
      patientIds.push((await response.json()).patient.id);
    }
    await page.goto(`/patients?search=page-${suffix}&pageSize=10`);
    await page.locator('a[rel="next"]').waitFor({ state: "visible" });
    await Promise.all([
      page.waitForURL(/page=2/),
      page.locator('a[rel="next"]').click(),
    ]);
    assert.match(page.url(), /search=page-/);
    await page.goBack();
    await page.waitForURL((url) => !url.searchParams.has("page"));

    await page.goto(
      `/patients?search=${normalizedMrn.toLowerCase()}&origin=LOCAL&ownership=NONE&syncStatus=NOT_SYNCED&pageSize=10`,
    );
    assert.match(page.url(), /search=/);
    const detailSelector = `a[href^="/patients/${patientId}?returnTo="]`;
    assert.equal(await page.locator(detailSelector).count(), 2);
    for (const detailLink of await page.locator(detailSelector).all()) {
      assert.equal((await detailLink.textContent()).trim(), normalizedMrn);
    }
    assert.equal(
      await page.locator(`a[href="/patients/${patientId}/send"]`).count(),
      2,
    );
    assert.equal(
      await page.locator(`a[href="/patients/${patientId}/schedule"]`).count(),
      2,
    );
    assert.equal(await page.locator(`tr ${detailSelector}`).count(), 1);
    assert.equal(
      await page
        .locator(`tr:has(${detailSelector})`)
        .getByText("Browser Verification", { exact: true })
        .locator("a")
        .count(),
      0,
    );
    await page.locator(detailSelector).filter({ visible: true }).click();
    await page.waitForURL(new RegExp(`/patients/${patientId}\\?returnTo=`));
    const backLink = page.getByRole("link", { name: "العودة إلى المرضى" });
    await backLink.waitFor({ state: "visible" });
    const backHref = await backLink.getAttribute("href");
    assert.match(backHref, /search=browser-/);
    assert.match(backHref, /origin=LOCAL/);
    await page.goto(backHref);

    const assessmentCount = await prisma.assessment.count({
      where: { patientId },
    });
    await page
      .locator(`a[href="/patients/${patientId}/send"]`)
      .filter({ visible: true })
      .click();
    await page.waitForURL(`${BASE_URL}/patients/${patientId}/send`);
    await page.locator("form").waitFor({ state: "visible" });
    await page.waitForFunction(() => document.title.length > 0);
    assert.equal(await page.locator("form").count(), 1);
    assert.equal(
      await page.locator('button[type="submit"]:enabled').count(),
      1,
    );
    await assertNoSeriousAccessibilityViolations(page);
    assert.equal(
      await prisma.assessment.count({ where: { patientId } }),
      assessmentCount,
    );
    await page.goto(`/patients?search=${normalizedMrn.toLowerCase()}`);
    const scheduleLink = page
      .locator(`a[href="/patients/${patientId}/schedule"]`)
      .filter({ visible: true });
    await scheduleLink.focus();
    await scheduleLink.press("Enter");
    await page.waitForURL(`${BASE_URL}/patients/${patientId}/schedule`);
    await page.locator("#scheduledFor").waitFor({ state: "visible" });
    await page.waitForFunction(() => document.title.length > 0);
    await page.locator("#scheduledFor").fill("2020-01-01T10:00");
    await page.locator('button[type="submit"]').click();
    await page.locator("#scheduledFor-error").waitFor({ state: "visible" });
    await assertNoSeriousAccessibilityViolations(page);
    assert.equal(
      await prisma.assessment.count({ where: { patientId } }),
      assessmentCount,
    );
    await page.goto(`/patients?search=NO-MATCH-${suffix}`);
    await page
      .getByRole("heading", { name: "لا يوجد مرضى مطابقون" })
      .waitFor({ state: "visible" });
    const clearFiltersLink = page
      .getByRole("link", { name: "مسح البحث وعوامل التصفية" })
      .first();
    assert.equal(await clearFiltersLink.getAttribute("href"), "/patients");
    await page.goto("/patients");
    await assertNoSeriousAccessibilityViolations(page);

    await page.goto(`/patients/${patientId}`);
    await page.getByRole("link", { name: "تعديل المريض" }).click();
    await page.waitForURL(`${BASE_URL}/patients/${patientId}/edit`);
    await page.locator("#firstName").fill("Updated Browser");
    await page.locator("#email").fill(" Updated.Browser@Example.TEST ");
    await page.getByRole("button", { name: "حفظ المريض" }).click();
    await page.waitForURL(`${BASE_URL}/patients/${patientId}`);
    await page
      .getByRole("heading", { name: /Updated Browser/ })
      .waitFor({ state: "visible" });
    await page
      .getByText("updated.browser@example.test")
      .waitFor({ state: "visible" });

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
    const archivedDetail = await page.goto(`/patients/${patientId}`);
    assert.ok([200, 404].includes(archivedDetail.status()));
    assert.ok(
      (await page.locator('meta[name="robots"][content="noindex"]').count()) >=
        1,
    );
    assert.equal((await page.content()).includes("Updated Browser"), false);
    const unknownDetail = await page.goto(`/patients/UNKNOWN-${suffix}`);
    assert.ok([200, 404].includes(unknownDetail.status()));
    assert.ok(
      (await page.locator('meta[name="robots"][content="noindex"]').count()) >=
        1,
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
      await prisma.assessment.deleteMany({
        where: { patientId: { in: patientIds } },
      });
      await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
    }

    await context.close();
    await browser.close();
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error("Patient browser verification failed.", {
    name: error instanceof Error ? error.name : "UnknownError",
  });
  process.exitCode = 1;
});
