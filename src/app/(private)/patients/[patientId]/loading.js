import { getTranslations } from "@/i18n/translations";
import { getRequestPreferences } from "@/server/preferences/current";

export default async function PatientDetailsLoading() {
  const { language } = await getRequestPreferences();
  const messages = getTranslations(language);

  return (
    <section aria-labelledby="patient-detail-loading-heading">
      <h1
        className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white"
        id="patient-detail-loading-heading"
      >
        {messages.patientDetails}
      </h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300" role="status">
        {messages.loadingPatientDetails}
      </p>
      <div aria-hidden="true" className="mt-6 space-y-6">
        {[1, 2, 3].map((section) => (
          <div
            className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900"
            key={section}
          />
        ))}
      </div>
    </section>
  );
}
