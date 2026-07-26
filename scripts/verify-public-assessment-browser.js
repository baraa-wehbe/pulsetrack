import "dotenv/config";

import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";
import axe from "axe-core";
import { chromium } from "playwright-core";

import { env } from "@/config/env.mjs";
import { PrismaClient } from "@/generated/prisma/client";
import {
  createAssessmentToken,
  hashAssessmentToken,
} from "@/server/assessments/token";

const BASE_URL = "http://localhost:3000";
const clinicianEmail = process.env.PULSETRACK_E2E_EMAIL;
const browserCandidates = [
  process.env.PULSETRACK_BROWSER_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);
const executablePath = browserCandidates.find((candidate) =>
  existsSync(candidate),
);

if (!clinicianEmail || !executablePath) {
  throw new Error("Public assessment browser prerequisites are unavailable.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});
let verificationStage = "setup";

const assertAccessible = async (page) => {
  await page.addScriptTag({ content: axe.source });
  const result = await page.evaluate(async () => globalThis.axe.run(document));
  assert.deepEqual(
    result.violations
      .filter(({ impact }) => ["critical", "serious"].includes(impact))
      .map(({ id, impact }) => ({ id, impact })),
    [],
  );
};

const main = async () => {
  const rawToken = createAssessmentToken();
  let browser;
  let patientId;
  let assessmentId;

  try {
    const [clinician, questionnaire] = await Promise.all([
      prisma.clinician.findUniqueOrThrow({
        where: { email: clinicianEmail },
      }),
      prisma.questionnaire.findFirstOrThrow({
        where: { code: "dsma-8", isActive: true },
      }),
    ]);
    const patient = await prisma.patient.create({
      data: {
        mrn: `PUBLIC-BROWSER-${Date.now()}`,
        firstName: "Public",
        lastName: "Browser",
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        sex: "UNKNOWN",
        email: "public-browser@example.test",
        createdById: clinician.id,
      },
    });
    patientId = patient.id;
    const now = new Date();
    const assessment = await prisma.assessment.create({
      data: {
        patientId,
        questionnaireId: questionnaire.id,
        createdById: clinician.id,
        recipientEmail: patient.email,
        scheduledFor: now,
        status: "SENT",
        tokenHash: hashAssessmentToken(rawToken),
        sentAt: now,
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    assessmentId = assessment.id;

    browser = await chromium.launch({ executablePath, headless: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await context.addCookies([
      {
        name: "pulsetrack_language",
        value: "ar",
        url: BASE_URL,
        httpOnly: true,
        sameSite: "Lax",
      },
      {
        name: "pulsetrack_theme",
        value: "dark",
        url: BASE_URL,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const page = await context.newPage();

    verificationStage = "token exchange";
    await page.goto(`${BASE_URL}/assessment/${rawToken}`);
    await page.waitForURL(`${BASE_URL}/assessment`);
    await page.locator("fieldset").first().waitFor({ state: "visible" });
    assert.equal(page.url().includes(rawToken), false);
    assert.equal((await page.content()).includes(rawToken), false);
    assert.equal(await page.locator("nav").count(), 0);
    assert.equal(await page.locator("fieldset").count(), 8);
    assert.equal(await page.locator('input[type="radio"]').count(), 32);
    assert.equal(await page.locator("html").getAttribute("lang"), "ar");
    assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
    assert.match(await page.locator("html").getAttribute("class"), /dark/);
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(dimensions.scrollWidth <= dimensions.clientWidth);
    await assertAccessible(page);

    verificationStage = "incomplete submission";
    await page.locator('button[type="submit"]').click();
    verificationStage = "incomplete validation message";
    await page.locator('form [role="alert"]').waitFor({ state: "visible" });
    verificationStage = "incomplete persistence check";
    assert.equal(
      await prisma.assessmentResponse.count({ where: { assessmentId } }),
      0,
    );

    for (let index = 1; index <= 8; index += 1) {
      verificationStage = `answer selection ${index}`;
      const value = index <= 5 ? 2 : 1;
      await page.locator(`input[name="q${index}"][value="${value}"]`).check();
    }
    verificationStage = "valid submission";
    await page.locator('button[type="submit"]').click();
    await page.locator('[role="status"] h1').waitFor({ state: "visible" });
    const stored = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { response: true },
    });
    assert.equal(stored.status, "COMPLETED");
    assert.equal(stored.response.totalScore, 13);
    assert.equal(stored.response.riskBand, "HIGH");
    assert.equal(
      (await context.cookies()).some(
        ({ name }) => name === "pulsetrack_assessment_access",
      ),
      false,
    );
    await assertAccessible(page);

    verificationStage = "single-use rejection";
    await page.goto(`${BASE_URL}/assessment/${rawToken}`);
    await page.waitForURL(/\/assessment\?state=unavailable$/);
    assert.equal(await page.locator("fieldset").count(), 0);
    assert.equal((await page.content()).includes(rawToken), false);

    console.log(
      "Public assessment browser, RTL, dark-theme, single-use, and accessibility verification passed.",
    );
  } finally {
    await browser?.close();
    if (assessmentId) {
      await prisma.auditLog.deleteMany({
        where: { entityType: "ASSESSMENT", entityId: assessmentId },
      });
      await prisma.assessment.deleteMany({ where: { id: assessmentId } });
    }
    if (patientId) {
      await prisma.patient.deleteMany({ where: { id: patientId } });
    }
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error("Public assessment browser verification failed.", {
    stage: verificationStage,
    name: error instanceof Error ? error.name : "UnknownError",
  });
  process.exitCode = 1;
});
