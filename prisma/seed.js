import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";

const QUESTIONNAIRE_FIXTURE_URL = new URL(
  "./seed-data/questionnaire-dsma8.json",
  import.meta.url,
);
const LAB_CATALOG_FIXTURE_URL = new URL(
  "./seed-data/lab-catalog.json",
  import.meta.url,
);

const readJson = async (url) => JSON.parse(await readFile(url, "utf8"));

export const loadQuestionnaireFixture = async () => {
  const fixture = await readJson(QUESTIONNAIRE_FIXTURE_URL);

  if (fixture.id !== "dsma-8" || fixture.version !== "1.0") {
    throw new Error(
      "The DSMA-8 seed fixture must have identity dsma-8 and version 1.0.",
    );
  }

  return fixture;
};

export const loadLabCatalogFixture = async () =>
  readJson(LAB_CATALOG_FIXTURE_URL);

const canonicalJson = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
};

export const hashQuestionnaireDefinition = (definition) =>
  createHash("sha256").update(canonicalJson(definition)).digest("hex");

const decimalEquals = (stored, expected) => {
  if (stored === null || stored === undefined) {
    return expected === null || expected === undefined;
  }

  if (typeof stored.equals === "function") {
    return stored.equals(expected);
  }

  return Number(stored) === Number(expected);
};

const assertQuestionnaireMatches = (stored, fixture, definitionHash) => {
  const metadataMatches =
    stored.code === fixture.id &&
    stored.version === fixture.version &&
    stored.title === fixture.title &&
    stored.instructions === fixture.instructions &&
    stored.definitionHash === definitionHash;

  if (!metadataMatches || !isDeepStrictEqual(stored.definition, fixture)) {
    throw new Error(
      `Immutable questionnaire version ${fixture.version} conflicts with the DSMA-8 source fixture.`,
    );
  }
};

const assertLabTestMatches = (stored, fixture) => {
  const matches =
    stored.code === fixture.code &&
    stored.name === fixture.name &&
    stored.loincCode === fixture.loincCode &&
    stored.defaultUnit === fixture.defaultUnit &&
    decimalEquals(stored.defaultRefLow, fixture.defaultRefLow) &&
    decimalEquals(stored.defaultRefHigh, fixture.defaultRefHigh) &&
    stored.isActive === true;

  if (!matches) {
    throw new Error(
      `Lab catalog entry ${fixture.code} conflicts with the supplied mapping.`,
    );
  }
};

const seedLabCatalog = async (transaction, fixtures) => {
  for (const fixture of fixtures) {
    const stored = await transaction.labTest.upsert({
      where: { code: fixture.code },
      create: {
        ...fixture,
        isActive: true,
      },
      update: {},
    });

    assertLabTestMatches(stored, fixture);
  }
};

const seedQuestionnaire = async (transaction, fixture) => {
  const definitionHash = hashQuestionnaireDefinition(fixture);
  const stored = await transaction.questionnaire.upsert({
    where: {
      code_version: {
        code: fixture.id,
        version: fixture.version,
      },
    },
    create: {
      code: fixture.id,
      version: fixture.version,
      title: fixture.title,
      instructions: fixture.instructions,
      definition: fixture,
      definitionHash,
      isActive: true,
    },
    update: {},
  });

  assertQuestionnaireMatches(stored, fixture, definitionHash);
};

export const seedDatabase = async (
  prismaClient,
  { questionnaireFixture, labCatalogFixture } = {},
) => {
  const questionnaire =
    questionnaireFixture ?? (await loadQuestionnaireFixture());
  const labCatalog = labCatalogFixture ?? (await loadLabCatalogFixture());

  await prismaClient.$transaction(
    async (transaction) => {
      await seedLabCatalog(transaction, labCatalog);
      await seedQuestionnaire(transaction, questionnaire);
    },
    { isolationLevel: "Serializable" },
  );
};
