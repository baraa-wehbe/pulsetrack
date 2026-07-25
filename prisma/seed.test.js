import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  hashQuestionnaireDefinition,
  loadLabCatalogFixture,
  loadQuestionnaireFixture,
  seedDatabase,
} from "./seed.js";

const createModels = (state) => ({
  questionnaire: {
    upsert: async ({ where, create }) => {
      const key = where.code_version;
      const existing = state.questionnaires.find(
        (item) => item.code === key.code && item.version === key.version,
      );

      if (existing) {
        return existing;
      }

      const inserted = {
        id: `questionnaire-${state.questionnaires.length + 1}`,
        ...structuredClone(create),
      };
      state.questionnaires.push(inserted);
      return inserted;
    },
  },
  labTest: {
    upsert: async ({ where, create }) => {
      const existing = state.labTests.find((item) => item.code === where.code);

      if (existing) {
        return existing;
      }

      const inserted = structuredClone(create);
      state.labTests.push(inserted);
      return inserted;
    },
  },
});

class InMemoryPrisma {
  constructor(initialState = {}) {
    this.state = {
      questionnaires: structuredClone(initialState.questionnaires ?? []),
      labTests: structuredClone(initialState.labTests ?? []),
    };
  }

  async $transaction(callback) {
    const workingState = structuredClone(this.state);
    const result = await callback(createModels(workingState));
    this.state = workingState;
    return result;
  }
}

test("first and second seed executions are idempotent", async () => {
  const prisma = new InMemoryPrisma();
  const labs = await loadLabCatalogFixture();

  await seedDatabase(prisma);

  assert.equal(prisma.state.questionnaires.length, 1);
  assert.equal(prisma.state.labTests.length, 3);
  assert.deepEqual(
    prisma.state.labTests.map(({ code, loincCode, defaultUnit }) => ({
      code,
      loincCode,
      defaultUnit,
    })),
    labs.map(({ code, loincCode, defaultUnit }) => ({
      code,
      loincCode,
      defaultUnit,
    })),
  );

  const questionnaireId = prisma.state.questionnaires[0].id;
  await seedDatabase(prisma);

  assert.equal(prisma.state.questionnaires.length, 1);
  assert.equal(prisma.state.labTests.length, 3);
  assert.equal(prisma.state.questionnaires[0].id, questionnaireId);
});

test("stored questionnaire definition deeply equals the source fixture", async () => {
  const prisma = new InMemoryPrisma();
  const source = JSON.parse(
    await readFile(
      new URL("./seed-data/questionnaire-dsma8.json", import.meta.url),
      "utf8",
    ),
  );

  await seedDatabase(prisma);

  assert.deepEqual(prisma.state.questionnaires[0].definition, source);
});

test("immutable questionnaire version 1.0 rejects conflicting JSON", async () => {
  const prisma = new InMemoryPrisma();
  await seedDatabase(prisma);
  prisma.state.questionnaires[0].definition.items[0].text =
    "Conflicting questionnaire text";

  await assert.rejects(
    seedDatabase(prisma),
    /Immutable questionnaire version 1\.0 conflicts/,
  );
  assert.equal(prisma.state.questionnaires.length, 1);
});

test("a questionnaire conflict rolls back lab catalog inserts", async () => {
  const questionnaire = await loadQuestionnaireFixture();
  const prisma = new InMemoryPrisma({
    questionnaires: [
      {
        id: "conflict",
        code: questionnaire.id,
        version: questionnaire.version,
        title: questionnaire.title,
        instructions: questionnaire.instructions,
        definition: { conflict: true },
        definitionHash: hashQuestionnaireDefinition({ conflict: true }),
        isActive: true,
      },
    ],
  });

  await assert.rejects(
    seedDatabase(prisma),
    /Immutable questionnaire version 1\.0 conflicts/,
  );
  assert.equal(prisma.state.labTests.length, 0);
  assert.equal(prisma.state.questionnaires.length, 1);
});
