import Link from "next/link";
import { notFound } from "next/navigation";

import ArchivePatientButton from "@/components/archive-patient-button";
import AssessmentBadge from "@/components/assessment-badge";
import FhirPatientActions from "@/components/fhir-patient-actions";
import PatientAssessmentModal from "@/components/patient-assessment-modal";
import PatientBadge from "@/components/patient-badge";
import { fhirConfiguration } from "@/config/env.mjs";
import { getTranslations } from "@/i18n/translations";
import {
  getAssessmentTimelineEntries,
  getRiskPresentation,
} from "@/lib/assessment-presentation";
import { resolvePatientListReturnPath } from "@/lib/patient-list";
import { patientIdentifierRouteParamsSchema } from "@/lib/patient-validation";
import { prisma } from "@/lib/prisma";
import { getActivePatientDetailByIdentifier } from "@/server/patients/service";
import { getRequestPreferences } from "@/server/preferences/current";

export const metadata = {
  title: "Patient details | PulseTrack",
};

const formatTimestamp = (value, language) =>
  new Intl.DateTimeFormat(language === "ar" ? "ar-LB" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));

const DemographicField = ({ label, ltr = false, value }) => (
  <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
    <dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt>
    <dd
      className="mt-1 break-words font-semibold text-slate-950 dark:text-white"
      dir={ltr ? "ltr" : undefined}
    >
      {value}
    </dd>
  </div>
);

export default async function PatientDetailsPage({ params, searchParams }) {
  const parsedParams = patientIdentifierRouteParamsSchema.safeParse(
    await params,
  );

  if (!parsedParams.success) {
    notFound();
  }

  const [{ language }, patient] = await Promise.all([
    getRequestPreferences(),
    getActivePatientDetailByIdentifier(prisma, parsedParams.data.patientId),
  ]);

  if (!patient) {
    notFound();
  }

  const query = await searchParams;
  const returnTo = resolvePatientListReturnPath(query?.returnTo);
  const messages = getTranslations(language);
  const assessmentNotice = {
    sent: messages.assessmentSentNotice,
    scheduled: messages.assessmentScheduledNotice,
    failed: messages.assessmentFailedNotice,
  }[typeof query?.assessment === "string" ? query.assessment : ""];
  const sex = {
    MALE: messages.sexMale,
    FEMALE: messages.sexFemale,
    OTHER: messages.sexOther,
    UNKNOWN: messages.sexUnknown,
  }[patient.sex];

  return (
    <section aria-labelledby="patient-heading">
      <Link
        className="rounded-md text-sm font-semibold text-teal-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:text-teal-300"
        href={returnTo}
      >
        {messages.backToPatients}
      </Link>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p
              className="text-sm font-semibold text-teal-700 dark:text-teal-300"
              dir="ltr"
            >
              {patient.mrn}
            </p>
            <h1
              className="mt-2 break-words text-3xl font-bold tracking-tight text-slate-950 dark:text-white"
              id="patient-heading"
            >
              {patient.firstName} {patient.lastName}
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <PatientAssessmentModal
              messages={messages}
              mode="IMMEDIATE"
              patient={patient}
              triggerClassName="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
            />
            <PatientAssessmentModal
              messages={messages}
              mode="SCHEDULED"
              patient={patient}
              triggerClassName="rounded-lg border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-teal-400 dark:text-teal-200 dark:hover:bg-teal-950"
            />
            <Link
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              href={`/patients/${patient.id}/edit`}
            >
              {messages.editPatient}
            </Link>
            <ArchivePatientButton
              messages={messages}
              patientIdentifier={patient.id}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <PatientBadge
            kind="origin"
            messages={messages}
            value={patient.origin}
          />
          <PatientBadge
            kind="ownership"
            messages={messages}
            value={patient.fhirOwnership}
          />
          <PatientBadge
            kind="syncStatus"
            messages={messages}
            value={
              fhirConfiguration.enabled
                ? patient.fhirSyncStatus
                : "NOT_CONFIGURED"
            }
          />
        </div>
        <FhirPatientActions
          configured={fhirConfiguration.enabled}
          externallyOwned={patient.fhirOwnership === "EXTERNAL_READ_ONLY"}
          messages={messages}
          patientId={patient.id}
        />
      </div>

      {assessmentNotice && (
        <p
          className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100"
          role="status"
        >
          {assessmentNotice}
        </p>
      )}

      <section
        aria-labelledby="demographics-heading"
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2
          className="text-xl font-bold text-slate-950 dark:text-white"
          id="demographics-heading"
        >
          {messages.demographics}
        </h2>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DemographicField label={messages.mrn} ltr value={patient.mrn} />
          <DemographicField
            label={messages.dateOfBirth}
            ltr
            value={patient.dateOfBirth}
          />
          <DemographicField label={messages.biologicalSex} value={sex} />
          <DemographicField
            label={messages.email}
            ltr={Boolean(patient.email)}
            value={patient.email ?? messages.notProvided}
          />
          <DemographicField
            label={messages.phone}
            ltr={Boolean(patient.phone)}
            value={patient.phone ?? messages.notProvided}
          />
          <DemographicField
            label={messages.lastUpdated}
            value={formatTimestamp(patient.updatedAt, language)}
          />
        </dl>
      </section>

      <section
        aria-labelledby="assessment-history-heading"
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900"
      >
        <div>
          <h2
            className="text-xl font-bold text-slate-950 dark:text-white"
            id="assessment-history-heading"
          >
            {messages.assessmentHistory}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {messages.assessmentHistoryDescription}
          </p>
        </div>

        {patient.assessments.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
            <h3 className="font-bold text-slate-950 dark:text-white">
              {messages.noAssessmentsTitle}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {messages.noAssessmentsDescription}
            </p>
          </div>
        ) : (
          <ol className="mt-6 space-y-4">
            {patient.assessments.map((assessment, index) => {
              const risk = assessment.response
                ? getRiskPresentation(assessment.response.riskBand)
                : null;

              return (
                <li
                  className="rounded-xl border border-slate-200 p-5 dark:border-slate-700"
                  key={`${assessment.createdAt}-${index}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-950 dark:text-white">
                        {assessment.questionnaire.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {messages.version}{" "}
                        <bdi dir="ltr">{assessment.questionnaire.version}</bdi>
                        {" · "}
                        {formatTimestamp(assessment.createdAt, language)}
                      </p>
                    </div>
                    <AssessmentBadge
                      kind="status"
                      messages={messages}
                      value={assessment.status}
                    />
                  </div>

                  <dl className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3 dark:text-slate-300">
                    {getAssessmentTimelineEntries(assessment).map((entry) => (
                      <div key={`${entry.translationKey}-${entry.value}`}>
                        <dt className="font-semibold">
                          {messages[entry.translationKey]}
                        </dt>
                        <dd>{formatTimestamp(entry.value, language)}</dd>
                      </div>
                    ))}
                  </dl>

                  {assessment.deliveryFailed && (
                    <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                      {messages.deliveryFailedDescription}
                    </p>
                  )}

                  {assessment.response ? (
                    <div className="mt-5 grid gap-4 sm:grid-cols-[auto_1fr]">
                      <div className="rounded-xl bg-slate-100 px-5 py-4 text-center dark:bg-slate-800">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {messages.dsmaScore}
                        </p>
                        <p className="mt-1 text-3xl font-black text-slate-950 dark:text-white">
                          <bdi dir="ltr">
                            {assessment.response.totalScore}
                            {assessment.response.scoreMaximum === null
                              ? ""
                              : ` / ${assessment.response.scoreMaximum}`}
                          </bdi>
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">
                            {messages.riskLevel}:
                          </span>
                          <AssessmentBadge
                            kind="risk"
                            messages={messages}
                            value={assessment.response.riskBand}
                          />
                        </div>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                          {messages[risk.guidanceKey]}
                        </p>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          {messages.submitted}{" "}
                          {formatTimestamp(
                            assessment.response.submittedAt,
                            language,
                          )}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                      {messages.assessmentNotScored}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section
        aria-labelledby="lab-summary-heading"
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2
          className="text-xl font-bold text-slate-950 dark:text-white"
          id="lab-summary-heading"
        >
          {messages.labSummary}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {messages.labSummaryDescription}
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {[
            [messages.fastingGlucose, "GLU-F"],
            [messages.hba1c, "HBA1C"],
            [messages.systolicBloodPressure, "SBP"],
          ].map(([label, code]) => (
            <article
              className="rounded-xl border border-dashed border-slate-300 p-5 dark:border-slate-700"
              key={code}
            >
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                <bdi dir="ltr">{code}</bdi>
              </p>
              <h3 className="mt-2 font-bold text-slate-950 dark:text-white">
                {label}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {messages.labDataComingLater}
              </p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
