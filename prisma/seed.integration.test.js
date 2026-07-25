import "dotenv/config";

import assert from "node:assert/strict";
import test from "node:test";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.ts";
import { env } from "../src/config/env.mjs";
import { loadLabCatalogFixture, loadQuestionnaireFixture } from "./seed.js";

test("seeded database matches the authoritative fixtures", async () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });

  try {
    const questionnaireFixture = await loadQuestionnaireFixture();
    const labCatalogFixture = await loadLabCatalogFixture();
    const [questionnaires, labTests] = await Promise.all([
      prisma.questionnaire.findMany({
        where: {
          code: questionnaireFixture.id,
          version: questionnaireFixture.version,
        },
      }),
      prisma.labTest.findMany({
        where: {
          code: { in: labCatalogFixture.map(({ code }) => code) },
        },
        orderBy: { code: "asc" },
      }),
    ]);

    assert.equal(questionnaires.length, 1);
    assert.deepEqual(questionnaires[0].definition, questionnaireFixture);
    assert.equal(labTests.length, 3);

    assert.deepEqual(
      labTests.map(
        ({
          code,
          name,
          loincCode,
          defaultUnit,
          defaultRefLow,
          defaultRefHigh,
        }) => ({
          code,
          name,
          loincCode,
          defaultUnit,
          defaultRefLow: defaultRefLow.toString(),
          defaultRefHigh: defaultRefHigh.toString(),
        }),
      ),
      labCatalogFixture
        .map((fixture) => ({
          ...fixture,
          defaultRefLow: Number(fixture.defaultRefLow).toString(),
          defaultRefHigh: Number(fixture.defaultRefHigh).toString(),
        }))
        .sort((left, right) => left.code.localeCompare(right.code)),
    );
  } finally {
    await prisma.$disconnect();
  }
});
