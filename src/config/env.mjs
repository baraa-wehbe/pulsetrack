import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z
    .url({ protocol: /^postgres(ql)?$/, hostname: z.regexes.hostname })
    .min(1),
  AUTH_SECRET: z.string().min(32),
  SCHEDULER_SECRET: z.string().min(32).optional(),
  LAB_CSV_MAX_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(20 * 1024 * 1024)
    .default(5 * 1024 * 1024),
  NEXT_PUBLIC_APP_URL: z.url(),
});

const result = environmentSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  SCHEDULER_SECRET: process.env.SCHEDULER_SECRET,
  LAB_CSV_MAX_BYTES: process.env.LAB_CSV_MAX_BYTES,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

if (!result.success) {
  const affectedVariables = [
    ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
  ];

  throw new Error(
    `Invalid environment configuration. Check: ${affectedVariables.join(", ")}`,
  );
}

export const env = Object.freeze(result.data);
