import { createHash, randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";

import dotenv from "dotenv";

dotenv.config({ path: [".env.local", ".env"], quiet: true });

const baseUrl = process.env.PULSETRACK_BENCHMARK_URL ?? "http://localhost:3000";
const warmupRounds = 1;
const measuredRounds = 3;

const main = async () => {
  const [{ prisma }, { AUTH_COOKIE_NAME }] = await Promise.all([
    import("@/lib/prisma-client"),
    import("@/config/auth"),
  ]);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  try {
    const clinician = await prisma.clinician.findFirstOrThrow({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    const [patient, labImport] = await Promise.all([
      prisma.patient.findFirst({
        where: { archivedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      }),
      prisma.labImport.findFirst({
        where: { uploadedById: clinician.id },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      }),
    ]);

    await prisma.clinicianSession.create({
      data: {
        clinicianId: clinician.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const paths = [
      "/",
      "/patients",
      "/lab-uploads",
      "/dashboard/patient",
      "/dashboard/clinic",
      "/fhir-sync",
      "/api/private/patients",
      "/api/private/lab-imports",
      ...(patient
        ? [
            `/patients/${encodeURIComponent(patient.id)}`,
            `/patients/${encodeURIComponent(patient.id)}/edit`,
            `/dashboard/patient?patient=${encodeURIComponent(patient.id)}`,
          ]
        : []),
      ...(labImport
        ? [`/lab-uploads/${encodeURIComponent(labImport.id)}`]
        : []),
    ];
    const results = new Map(paths.map((path) => [path, []]));

    for (let round = 0; round < warmupRounds + measuredRounds; round += 1) {
      for (const path of paths) {
        const startedAt = performance.now();
        const response = await fetch(`${baseUrl}${path}`, {
          headers: { Cookie: `${AUTH_COOKIE_NAME}=${token}` },
        });
        const body = await response.arrayBuffer();
        const durationMs = performance.now() - startedAt;

        if (response.status >= 400 || response.url.endsWith("/login")) {
          throw new Error(`${path} returned HTTP ${response.status}.`);
        }
        if (round >= warmupRounds) {
          results.get(path).push(durationMs);
        }
        if (round === warmupRounds) {
          process.stdout.write(
            `${path}\t${response.status}\t${body.byteLength} bytes\n`,
          );
        }
      }
    }

    process.stdout.write("\nProduction server timings after warm-up:\n");
    for (const [path, samples] of results) {
      const sorted = [...samples].sort((left, right) => left - right);
      const average =
        samples.reduce((total, sample) => total + sample, 0) / samples.length;
      process.stdout.write(
        `${path}\tavg ${average.toFixed(1)} ms\tmax ${sorted.at(-1).toFixed(1)} ms\n`,
      );
    }
  } finally {
    await prisma.clinicianSession.deleteMany({ where: { tokenHash } });
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Benchmark failed.");
  process.exitCode = 1;
});
