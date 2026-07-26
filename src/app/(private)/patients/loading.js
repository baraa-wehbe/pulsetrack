import { getTranslations } from "@/i18n/translations";
import { getRequestPreferences } from "@/server/preferences/current";

export default async function PatientsLoading() {
  const { language } = await getRequestPreferences();
  const messages = getTranslations(language);

  return (
    <section aria-labelledby="patients-loading-heading" aria-live="polite">
      <h1
        className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white"
        id="patients-loading-heading"
      >
        {messages.patientsHeading}
      </h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300" role="status">
        {messages.loadingPatients}
      </p>
      <div
        aria-hidden="true"
        className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="h-10 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="mt-6 space-y-3">
          {[1, 2, 3, 4].map((row) => (
            <div
              className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/70"
              key={row}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
