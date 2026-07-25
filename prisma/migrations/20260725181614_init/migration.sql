-- CreateEnum
CREATE TYPE "ClinicianStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "AppLocale" AS ENUM ('EN', 'AR');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "BiologicalSex" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PatientOrigin" AS ENUM ('LOCAL', 'FHIR');

-- CreateEnum
CREATE TYPE "FhirOwnership" AS ENUM ('NONE', 'CANDIDATE_OWNED', 'EXTERNAL_READ_ONLY');

-- CreateEnum
CREATE TYPE "FhirSyncStatus" AS ENUM ('NOT_SYNCED', 'PENDING', 'SYNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('SCHEDULED', 'SENT', 'COMPLETED', 'EXPIRED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RiskBand" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "LabImportStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');

-- CreateEnum
CREATE TYPE "LabImportRowStatus" AS ENUM ('ACCEPTED', 'REJECTED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "LabResultSource" AS ENUM ('CSV', 'FHIR');

-- CreateEnum
CREATE TYPE "FhirSyncDirection" AS ENUM ('PUSH', 'PULL');

-- CreateEnum
CREATE TYPE "FhirSyncTrigger" AS ENUM ('EVENT', 'MANUAL', 'CRON');

-- CreateEnum
CREATE TYPE "FhirSyncRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "FhirSyncTaskStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "FhirResourceType" AS ENUM ('PATIENT', 'OBSERVATION');

-- CreateEnum
CREATE TYPE "FhirSyncScope" AS ENUM ('ALL', 'PATIENT', 'OBSERVATION');

-- CreateEnum
CREATE TYPE "FhirOperation" AS ENUM ('CREATE', 'UPDATE', 'IMPORT', 'SKIP');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('CLINICIAN', 'PATIENT_LINK', 'SYSTEM');

-- CreateTable
CREATE TABLE "clinicians" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" VARCHAR(160) NOT NULL,
    "status" "ClinicianStatus" NOT NULL DEFAULT 'ACTIVE',
    "preferred_locale" "AppLocale" NOT NULL DEFAULT 'EN',
    "theme_preference" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clinicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "mrn" VARCHAR(50) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "sex" "BiologicalSex" NOT NULL,
    "email" VARCHAR(320),
    "phone" VARCHAR(32),
    "origin" "PatientOrigin" NOT NULL DEFAULT 'LOCAL',
    "fhir_resource_id" VARCHAR(100),
    "fhir_version_id" VARCHAR(100),
    "fhir_ownership" "FhirOwnership" NOT NULL DEFAULT 'NONE',
    "fhir_sync_status" "FhirSyncStatus" NOT NULL DEFAULT 'NOT_SYNCED',
    "fhir_last_synced_at" TIMESTAMPTZ(3),
    "fhir_last_sync_error" TEXT,
    "created_by_id" UUID,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questionnaires" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "version" VARCHAR(30) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "instructions" TEXT,
    "definition" JSONB NOT NULL,
    "definition_hash" CHAR(64) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questionnaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "questionnaire_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "recipient_email" VARCHAR(320) NOT NULL,
    "scheduled_for" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "token_hash" CHAR(64),
    "sent_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "token_consumed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "send_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_send_error" TEXT,
    "email_provider_message_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_responses" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "answers" JSONB NOT NULL,
    "total_score" SMALLINT NOT NULL,
    "risk_band" "RiskBand" NOT NULL,
    "scoring_snapshot" JSONB NOT NULL,
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_delivery_attempts" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "status" "DeliveryStatus" NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "provider_message_id" VARCHAR(255),
    "error_code" VARCHAR(100),
    "error_message" TEXT,
    "attempted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_tests" (
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "loinc_code" VARCHAR(20) NOT NULL,
    "default_unit" VARCHAR(30) NOT NULL,
    "default_ref_low" DECIMAL(12,4),
    "default_ref_high" DECIMAL(12,4),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lab_tests_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "lab_imports" (
    "id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "file_sha256" CHAR(64) NOT NULL,
    "status" "LabImportStatus" NOT NULL DEFAULT 'PROCESSING',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "accepted_rows" INTEGER NOT NULL DEFAULT 0,
    "rejected_rows" INTEGER NOT NULL DEFAULT 0,
    "duplicate_rows" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_import_rows" (
    "id" UUID NOT NULL,
    "import_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "status" "LabImportRowStatus" NOT NULL,
    "raw_data" JSONB NOT NULL,
    "normalized_data" JSONB,
    "validation_errors" JSONB NOT NULL,
    "lab_result_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_results" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "test_code" VARCHAR(20) NOT NULL,
    "collected_date" DATE NOT NULL,
    "value" DECIMAL(12,4) NOT NULL,
    "unit" VARCHAR(30) NOT NULL,
    "ref_low" DECIMAL(12,4),
    "ref_high" DECIMAL(12,4),
    "source" "LabResultSource" NOT NULL,
    "fhir_resource_id" VARCHAR(100),
    "fhir_version_id" VARCHAR(100),
    "fhir_ownership" "FhirOwnership" NOT NULL DEFAULT 'NONE',
    "fhir_sync_status" "FhirSyncStatus" NOT NULL DEFAULT 'NOT_SYNCED',
    "fhir_last_synced_at" TIMESTAMPTZ(3),
    "fhir_last_sync_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fhir_sync_runs" (
    "id" UUID NOT NULL,
    "direction" "FhirSyncDirection" NOT NULL,
    "trigger" "FhirSyncTrigger" NOT NULL,
    "scope" "FhirSyncScope" NOT NULL,
    "status" "FhirSyncRunStatus" NOT NULL DEFAULT 'RUNNING',
    "initiated_by_id" UUID,
    "discovered_count" INTEGER NOT NULL DEFAULT 0,
    "succeeded_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "checkpoint" JSONB,
    "last_error" TEXT,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "fhir_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fhir_sync_tasks" (
    "id" UUID NOT NULL,
    "run_id" UUID,
    "direction" "FhirSyncDirection" NOT NULL,
    "trigger" "FhirSyncTrigger" NOT NULL,
    "resource_type" "FhirResourceType" NOT NULL,
    "operation" "FhirOperation" NOT NULL,
    "status" "FhirSyncTaskStatus" NOT NULL DEFAULT 'PENDING',
    "patient_id" UUID,
    "lab_result_id" UUID,
    "fhir_resource_id" VARCHAR(100),
    "deduplication_key" VARCHAR(255) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3),
    "locked_at" TIMESTAMPTZ(3),
    "last_error_code" VARCHAR(100),
    "last_error_message" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "fhir_sync_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_type" "AuditActorType" NOT NULL,
    "clinician_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(100) NOT NULL,
    "request_id" VARCHAR(100),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinicians_email_key" ON "clinicians"("email");

-- CreateIndex
CREATE UNIQUE INDEX "patients_mrn_key" ON "patients"("mrn");

-- CreateIndex
CREATE UNIQUE INDEX "patients_fhir_resource_id_key" ON "patients"("fhir_resource_id");

-- CreateIndex
CREATE INDEX "patients_name_idx" ON "patients"("last_name", "first_name");

-- CreateIndex
CREATE INDEX "patients_archived_at_idx" ON "patients"("archived_at");

-- CreateIndex
CREATE INDEX "patients_fhir_state_idx" ON "patients"("origin", "fhir_sync_status");

-- CreateIndex
CREATE UNIQUE INDEX "questionnaires_definition_hash_key" ON "questionnaires"("definition_hash");

-- CreateIndex
CREATE INDEX "questionnaires_code_active_idx" ON "questionnaires"("code", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "questionnaires_code_version_key" ON "questionnaires"("code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "assessments_token_hash_key" ON "assessments"("token_hash");

-- CreateIndex
CREATE INDEX "assessments_patient_created_at_idx" ON "assessments"("patient_id", "created_at");

-- CreateIndex
CREATE INDEX "assessments_status_scheduled_for_idx" ON "assessments"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "assessments_status_expires_at_idx" ON "assessments"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_responses_assessment_id_key" ON "assessment_responses"("assessment_id");

-- CreateIndex
CREATE INDEX "assessment_responses_risk_submitted_idx" ON "assessment_responses"("risk_band", "submitted_at");

-- CreateIndex
CREATE INDEX "assessment_delivery_attempts_status_idx" ON "assessment_delivery_attempts"("status", "attempted_at");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_delivery_attempts_number_key" ON "assessment_delivery_attempts"("assessment_id", "attempt_number");

-- CreateIndex
CREATE UNIQUE INDEX "lab_tests_loinc_code_key" ON "lab_tests"("loinc_code");

-- CreateIndex
CREATE INDEX "lab_imports_uploader_created_at_idx" ON "lab_imports"("uploaded_by_id", "created_at");

-- CreateIndex
CREATE INDEX "lab_imports_status_created_at_idx" ON "lab_imports"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "lab_import_rows_lab_result_id_key" ON "lab_import_rows"("lab_result_id");

-- CreateIndex
CREATE INDEX "lab_import_rows_import_status_idx" ON "lab_import_rows"("import_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "lab_import_rows_import_row_number_key" ON "lab_import_rows"("import_id", "row_number");

-- CreateIndex
CREATE UNIQUE INDEX "lab_results_fhir_resource_id_key" ON "lab_results"("fhir_resource_id");

-- CreateIndex
CREATE INDEX "lab_results_patient_test_date_idx" ON "lab_results"("patient_id", "test_code", "collected_date");

-- CreateIndex
CREATE INDEX "lab_results_source_created_at_idx" ON "lab_results"("source", "created_at");

-- CreateIndex
CREATE INDEX "lab_results_fhir_status_idx" ON "lab_results"("fhir_sync_status", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "lab_results_patient_date_test_key" ON "lab_results"("patient_id", "collected_date", "test_code");

-- CreateIndex
CREATE INDEX "fhir_sync_runs_direction_status_idx" ON "fhir_sync_runs"("direction", "status", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "fhir_sync_tasks_deduplication_key" ON "fhir_sync_tasks"("deduplication_key");

-- CreateIndex
CREATE INDEX "fhir_sync_tasks_retry_idx" ON "fhir_sync_tasks"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "fhir_sync_tasks_resource_idx" ON "fhir_sync_tasks"("resource_type", "fhir_resource_id");

-- CreateIndex
CREATE INDEX "fhir_sync_tasks_patient_idx" ON "fhir_sync_tasks"("patient_id", "created_at");

-- CreateIndex
CREATE INDEX "fhir_sync_tasks_lab_result_idx" ON "fhir_sync_tasks"("lab_result_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_clinician_idx" ON "audit_logs"("clinician_id", "created_at");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "clinicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_questionnaire_id_fkey" FOREIGN KEY ("questionnaire_id") REFERENCES "questionnaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "clinicians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_responses" ADD CONSTRAINT "assessment_responses_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_delivery_attempts" ADD CONSTRAINT "assessment_delivery_attempts_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_imports" ADD CONSTRAINT "lab_imports_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "clinicians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_import_rows" ADD CONSTRAINT "lab_import_rows_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "lab_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_import_rows" ADD CONSTRAINT "lab_import_rows_lab_result_id_fkey" FOREIGN KEY ("lab_result_id") REFERENCES "lab_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_test_code_fkey" FOREIGN KEY ("test_code") REFERENCES "lab_tests"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fhir_sync_runs" ADD CONSTRAINT "fhir_sync_runs_initiated_by_id_fkey" FOREIGN KEY ("initiated_by_id") REFERENCES "clinicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fhir_sync_tasks" ADD CONSTRAINT "fhir_sync_tasks_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "fhir_sync_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fhir_sync_tasks" ADD CONSTRAINT "fhir_sync_tasks_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fhir_sync_tasks" ADD CONSTRAINT "fhir_sync_tasks_lab_result_id_fkey" FOREIGN KEY ("lab_result_id") REFERENCES "lab_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_clinician_id_fkey" FOREIGN KEY ("clinician_id") REFERENCES "clinicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;
