import { z } from "zod";

export const ASSESSMENT_DELIVERY_MODES = Object.freeze([
  "IMMEDIATE",
  "SCHEDULED",
]);

const scheduledTimestampSchema = z
  .string()
  .max(40, "invalid_schedule")
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value,
      ) && Number.isFinite(Date.parse(value)),
    "invalid_schedule",
  );

export const createAssessmentRequestSchemaForDate = (now = new Date()) =>
  z
    .object({
      deliveryMode: z.enum(ASSESSMENT_DELIVERY_MODES),
      scheduledFor: z.union([scheduledTimestampSchema, z.null()]).optional(),
    })
    .strict()
    .superRefine((value, context) => {
      if (value.deliveryMode === "IMMEDIATE") {
        if (value.scheduledFor) {
          context.addIssue({
            code: "custom",
            path: ["scheduledFor"],
            message: "immediate_has_schedule",
          });
        }
        return;
      }

      if (!value.scheduledFor) {
        context.addIssue({
          code: "custom",
          path: ["scheduledFor"],
          message: "required",
        });
        return;
      }

      if (Date.parse(value.scheduledFor) <= now.getTime()) {
        context.addIssue({
          code: "custom",
          path: ["scheduledFor"],
          message: "past_schedule",
        });
      }
    })
    .transform((value) => ({
      deliveryMode: value.deliveryMode,
      scheduledFor:
        value.deliveryMode === "SCHEDULED"
          ? new Date(value.scheduledFor)
          : null,
    }));

export const assessmentRequestSchema = createAssessmentRequestSchemaForDate();
