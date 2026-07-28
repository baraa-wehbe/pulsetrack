import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import dotenv from "dotenv";

dotenv.config({ path: [".env.local", ".env"], quiet: true });

const ADMIN_FIXTURE_URL = new URL(
  "../prisma/seed-data/admin-user.json",
  import.meta.url,
);

export const readStartupClinician = async () => {
  const fixture = JSON.parse(await readFile(ADMIN_FIXTURE_URL, "utf8"));

  return {
    email: fixture.email,
    fullName: fixture.name,
    password: fixture.password,
  };
};

const main = async () => {
  const [
    { prisma },
    {
      ClinicianCreationError,
      createActiveClinician,
      createClinicianInputSchema,
    },
  ] = await Promise.all([
    import("@/lib/prisma-client"),
    import("@/server/auth/create-clinician"),
  ]);

  try {
    const input = await readStartupClinician();
    const parsed = createClinicianInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error("The startup clinician fixture is invalid.");
    }

    const existing = await prisma.clinician.findUnique({
      where: { email: parsed.data.email },
      select: { email: true, status: true },
    });
    if (existing) {
      console.log(
        `[startup] Clinician ${existing.email} already exists with status ${existing.status}.`,
      );
      return;
    }

    try {
      const clinician = await createActiveClinician(prisma, parsed.data);
      console.log(
        `[startup] Added clinician ${clinician.email} with status ${clinician.status}.`,
      );
    } catch (error) {
      if (
        error instanceof ClinicianCreationError &&
        error.code === "DUPLICATE_EMAIL"
      ) {
        console.log(`[startup] Clinician ${parsed.data.email} already exists.`);
        return;
      }
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
};

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main().catch((error) => {
    console.error("[startup] Clinician provisioning failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    process.exitCode = 1;
  });
}
