-- Add this SQL to a Prisma migration created with:
-- npx prisma migrate dev --create-only --name database_hardening
-- Then run: npx prisma migrate dev

ALTER TABLE "clinicians"
  ADD CONSTRAINT "clinicians_email_lowercase_chk"
  CHECK ("email" = lower("email"));

ALTER TABLE "patients"
  ADD CONSTRAINT "patients_mrn_format_chk"
  CHECK ("mrn" = upper("mrn") AND "mrn" ~ '^[A-Z0-9-]+$'),
  ADD CONSTRAINT "patients_email_lowercase_chk"
  CHECK ("email" IS NULL OR "email" = lower("email"));

ALTER TABLE "questionnaires"
  ADD CONSTRAINT "questionnaires_definition_object_chk"
  CHECK (jsonb_typeof("definition") = 'object');

ALTER TABLE "assessments"
  ADD CONSTRAINT "assessments_send_attempts_nonnegative_chk"
  CHECK ("send_attempts" >= 0),
  ADD CONSTRAINT "assessments_expiry_after_send_chk"
  CHECK (
    "expires_at" IS NULL
    OR (
      "sent_at" IS NOT NULL
      AND "expires_at" > "sent_at"
    )
  ),
  ADD CONSTRAINT "assessments_token_hash_length_chk"
  CHECK ("token_hash" IS NULL OR length("token_hash") = 64);

ALTER TABLE "assessment_responses"
  ADD CONSTRAINT "assessment_responses_answers_object_chk"
  CHECK (jsonb_typeof("answers") = 'object'),
  ADD CONSTRAINT "assessment_responses_scoring_object_chk"
  CHECK (jsonb_typeof("scoring_snapshot") = 'object'),
  ADD CONSTRAINT "assessment_responses_score_nonnegative_chk"
  CHECK ("total_score" >= 0);

ALTER TABLE "assessment_delivery_attempts"
  ADD CONSTRAINT "assessment_delivery_attempts_number_positive_chk"
  CHECK ("attempt_number" > 0);

ALTER TABLE "lab_tests"
  ADD CONSTRAINT "lab_tests_code_uppercase_chk"
  CHECK ("code" = upper("code")),
  ADD CONSTRAINT "lab_tests_reference_range_chk"
  CHECK (
    "default_ref_low" IS NULL
    OR "default_ref_high" IS NULL
    OR "default_ref_low" <= "default_ref_high"
  );

ALTER TABLE "lab_imports"
  ADD CONSTRAINT "lab_imports_counts_nonnegative_chk"
  CHECK (
    "total_rows" >= 0
    AND "accepted_rows" >= 0
    AND "rejected_rows" >= 0
    AND "duplicate_rows" >= 0
  ),
  ADD CONSTRAINT "lab_imports_counts_within_total_chk"
  CHECK (
    "accepted_rows" + "rejected_rows" + "duplicate_rows" <= "total_rows"
  );

ALTER TABLE "lab_import_rows"
  ADD CONSTRAINT "lab_import_rows_row_number_positive_chk"
  CHECK ("row_number" > 0),
  ADD CONSTRAINT "lab_import_rows_raw_object_chk"
  CHECK (jsonb_typeof("raw_data") = 'object'),
  ADD CONSTRAINT "lab_import_rows_normalized_object_chk"
  CHECK ("normalized_data" IS NULL OR jsonb_typeof("normalized_data") = 'object'),
  ADD CONSTRAINT "lab_import_rows_errors_array_chk"
  CHECK (jsonb_typeof("validation_errors") = 'array');

ALTER TABLE "lab_results"
  ADD CONSTRAINT "lab_results_reference_range_chk"
  CHECK (
    "ref_low" IS NULL
    OR "ref_high" IS NULL
    OR "ref_low" <= "ref_high"
  );

ALTER TABLE "fhir_sync_runs"
  ADD CONSTRAINT "fhir_sync_runs_counts_nonnegative_chk"
  CHECK (
    "discovered_count" >= 0
    AND "succeeded_count" >= 0
    AND "failed_count" >= 0
    AND "skipped_count" >= 0
  );

ALTER TABLE "fhir_sync_tasks"
  ADD CONSTRAINT "fhir_sync_tasks_attempts_nonnegative_chk"
  CHECK ("attempts" >= 0),
  ADD CONSTRAINT "fhir_sync_tasks_local_reference_chk"
  CHECK (
    ("resource_type" = 'PATIENT' AND "lab_result_id" IS NULL)
    OR ("resource_type" = 'OBSERVATION' AND "patient_id" IS NULL)
  );

-- Efficient scheduler and retry scans.
CREATE INDEX "assessments_scheduled_pending_idx"
  ON "assessments" ("scheduled_for")
  WHERE "status" = 'SCHEDULED';

CREATE INDEX "assessments_sent_expiry_idx"
  ON "assessments" ("expires_at")
  WHERE "status" = 'SENT';

CREATE INDEX "fhir_sync_tasks_pending_retry_idx"
  ON "fhir_sync_tasks" ("next_attempt_at", "created_at")
  WHERE "status" IN ('PENDING', 'FAILED');

-- Patient list search support without adding a PostgreSQL extension.
CREATE INDEX "patients_mrn_lower_idx"
  ON "patients" (lower("mrn"));

CREATE INDEX "patients_name_lower_idx"
  ON "patients" (lower("last_name"), lower("first_name"));
