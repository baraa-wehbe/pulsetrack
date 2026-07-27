import FhirSyncControl from "@/components/fhir-sync-control";
import { fhirConfiguration } from "@/config/env.mjs";
import { getTranslations } from "@/i18n/translations";
import { prisma } from "@/lib/prisma";
import { listFhirSyncActivity } from "@/server/fhir/management";
import { getRequestPreferences } from "@/server/preferences/current";

export const metadata = { title: "FHIR synchronization | PulseTrack" };
export const dynamic = "force-dynamic";

const timestamp = (value, language) =>
  value
    ? new Intl.DateTimeFormat(language === "ar" ? "ar-LB" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(new Date(value))
    : "—";

const statusPresentation = (status, messages) =>
  ({
    RUNNING: {
      label: messages.fhirStatusRunning,
      className:
        "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100",
    },
    SUCCEEDED: {
      label: messages.fhirStatusSucceeded,
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
    },
    PARTIAL: {
      label: messages.fhirStatusPartial,
      className:
        "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100",
    },
    FAILED: {
      label: messages.fhirStatusFailed,
      className:
        "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100",
    },
  })[status] ?? {
    label: status,
    className:
      "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100",
  };

const RunCount = ({ label, value }) => (
  <div>
    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {label}
    </dt>
    <dd className="mt-1 text-lg font-bold tabular-nums text-slate-950 dark:text-white">
      {value}
    </dd>
  </div>
);

export default async function FhirSyncPage() {
  const [{ language }, activity] = await Promise.all([
    getRequestPreferences(),
    listFhirSyncActivity(prisma),
  ]);
  const messages = getTranslations(language);
  const latestRun = activity.runs[0];
  const configured = fhirConfiguration.enabled;

  return (
    <section aria-labelledby="fhir-sync-heading">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">
            {messages.clinicalIntegration}
          </p>
          <h1
            className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white"
            id="fhir-sync-heading"
          >
            {messages.fhirSyncHeading}
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            {messages.fhirSyncDescription}
          </p>
        </div>
      </div>

      <section
        aria-labelledby="integration-status-heading"
        className="mt-7 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2
                className="text-xl font-bold text-slate-950 dark:text-white"
                id="integration-status-heading"
              >
                {messages.integrationStatus}
              </h2>
              <span
                className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold ${
                  configured
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                    : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
                }`}
              >
                {configured
                  ? messages.fhirConfigurationEnabled
                  : messages.fhirConfigurationDisabled}
              </span>
            </div>
            <p className="mt-3 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              {messages.fhirSyncActionDescription}
            </p>
            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {messages.lastRun}
                </dt>
                <dd className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {timestamp(latestRun?.startedAt, language)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {messages.latestOutcome}
                </dt>
                <dd className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {latestRun
                    ? statusPresentation(latestRun.status, messages).label
                    : messages.notAvailable}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {messages.retryableFailures}
                </dt>
                <dd className="mt-1 font-semibold tabular-nums text-slate-900 dark:text-white">
                  {
                    activity.failures.filter((failure) => failure.retryEligible)
                      .length
                  }
                </dd>
              </div>
            </dl>
          </div>
          <FhirSyncControl configured={configured} messages={messages} />
        </div>
        {!configured ? (
          <p
            className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
            role="status"
          >
            {messages.fhirNotConfiguredDescription}
          </p>
        ) : null}
      </section>

      <section className="mt-8" aria-labelledby="sync-runs-heading">
        <h2
          className="text-xl font-bold text-slate-950 dark:text-white"
          id="sync-runs-heading"
        >
          {messages.syncRuns}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {messages.syncRunLegend}
        </p>
        {activity.runs.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {messages.noSyncRuns}
          </p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {activity.runs.map((run, index) => {
              const status = statusPresentation(run.status, messages);
              return (
                <article
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  key={`${run.startedAt}-${index}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-950 dark:text-white">
                        {run.direction === "PULL"
                          ? messages.fhirImportedRun
                          : messages.fhirPushedRun}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {run.trigger === "MANUAL"
                          ? messages.fhirManualTrigger
                          : messages.fhirScheduledTrigger}
                      </p>
                    </div>
                    <span
                      className={`rounded-md border px-2.5 py-1 text-xs font-bold ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <RunCount
                      label={messages.discovered}
                      value={run.discoveredCount}
                    />
                    <RunCount
                      label={messages.processed}
                      value={run.succeededCount}
                    />
                    <RunCount label={messages.failed} value={run.failedCount} />
                    <RunCount
                      label={messages.skipped}
                      value={run.skippedCount}
                    />
                  </dl>
                  <dl className="mt-5 grid gap-3 border-t border-slate-200 pt-4 text-sm sm:grid-cols-2 dark:border-slate-700">
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">
                        {messages.started}
                      </dt>
                      <dd>{timestamp(run.startedAt, language)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">
                        {messages.completed}
                      </dt>
                      <dd>{timestamp(run.completedAt, language)}</dd>
                    </div>
                  </dl>
                  {run.lastError ? (
                    <p
                      className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
                      role="alert"
                    >
                      {run.lastError}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8" aria-labelledby="failed-tasks-heading">
        <h2
          className="text-xl font-bold text-slate-950 dark:text-white"
          id="failed-tasks-heading"
        >
          {messages.failedTasks}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {messages.failedTasksDescription}
        </p>
        {activity.failures.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {messages.noFailedTasks}
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activity.failures.map((failure, index) => (
              <article
                className="rounded-xl border border-red-200 bg-white p-5 dark:border-red-900 dark:bg-slate-900"
                key={`${failure.updatedAt}-${index}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-slate-950 dark:text-white">
                    {failure.resourceType === "OBSERVATION"
                      ? messages.fhirObservation
                      : messages.fhirPatientResource}
                  </h3>
                  <span className="text-xs font-bold uppercase tracking-wide text-red-700 dark:text-red-300">
                    {failure.retryEligible
                      ? messages.retryAvailable
                      : messages.reviewRequired}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
                  {failure.errorMessage}
                </p>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500 dark:text-slate-400">
                      {messages.attempts}
                    </dt>
                    <dd className="font-semibold tabular-nums">
                      {failure.attempts}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500 dark:text-slate-400">
                      {messages.retryAt}
                    </dt>
                    <dd>{timestamp(failure.nextAttemptAt, language)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
