import { z } from "zod";

import { LANGUAGE_VALUES, THEME_VALUES } from "@/config/preferences";

export const preferenceUpdateSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("language"),
      value: z.enum(LANGUAGE_VALUES),
    })
    .strict(),
  z
    .object({
      kind: z.literal("theme"),
      value: z.enum(THEME_VALUES),
    })
    .strict(),
]);
