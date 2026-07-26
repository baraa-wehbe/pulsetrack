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

export default async function FhirSyncPage() {
  const [{ language }, activity] = await Promise.all([
    getRequestPreferences(),
    listFhirSyncActivity(prisma),
  ]);
  const messages = getTranslations(language);

  return (
    <section aria-labelledby="fhir-sync-heading">
      <h1
        className="text-3xl font-bold text-slate-950 dark:text-white"
        id="fhir-sync-heading"
      >
        {messages.fhirSyncHeading}
      </h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        {messages.fhirSyncDescription}
      </p>

      <section className="mt-8" aria-labelledby="sync-runs-heading">
        <h2
          className="text-xl font-bold text-slate-950 dark:text-white"
          id="sync-runs-heading"
        >
          {messages.syncRuns}
        </h2>
        {activity.runs.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {messages.noSyncRuns}
          </p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {activity.runs.map((run, index) => (
              <article
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                key={`${run.startedAt}-${index}`}
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <h3 className="font-bold text-slate-950 dark:text-white">
                    {run.direction} · {run.scope}
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold dark:bg-slate-800">
                    {run.status}
                  </span>
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">{messages.trigger}</dt>
                    <dd>{run.trigger}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{messages.counts}</dt>
                    <dd>
                      {run.succeededCount} / {run.failedCount} /{" "}
                      {run.skippedCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{messages.started}</dt>
                    <dd>{timestamp(run.startedAt, language)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{messages.completed}</dt>
                    <dd>{timestamp(run.completedAt, language)}</dd>
                  </div>
                </dl>
                {run.lastError && (
                  <p className="mt-3 text-sm text-red-700 dark:text-red-300">
                    {run.lastError}
                  </p>
                )}
              </article>
            ))}
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
        {activity.failures.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {messages.noFailedTasks}
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activity.failures.map((failure, index) => (
              <article
                className="rounded-2xl border border-red-200 bg-white p-5 dark:border-red-900 dark:bg-slate-900"
                key={`${failure.updatedAt}-${index}`}
              >
                <h3 className="font-bold text-slate-950 dark:text-white">
                  {failure.resourceType}
                </h3>
                <dl className="mt-4 space-y-2 text-sm">
                  <div>
                    <dt className="text-slate-500">{messages.safeError}</dt>
                    <dd>
                      {failure.errorCode}: {failure.errorMessage}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{messages.attempts}</dt>
                    <dd>{failure.attempts}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{messages.retryAt}</dt>
                    <dd>{timestamp(failure.nextAttemptAt, language)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{messages.retryEligible}</dt>
                    <dd>
                      {failure.retryEligible ? messages.yes : messages.no}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{messages.context}</dt>
                    <dd>{failure.context}</dd>
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
