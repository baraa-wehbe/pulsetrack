import { getTranslations } from "@/i18n/translations";
import { getRequestPreferences } from "@/server/preferences/current";

export default async function ClinicDashboardLoading() {
  const { language } = await getRequestPreferences();
  const messages = getTranslations(language);

  return (
    <section aria-live="polite">
      <h1 className="text-3xl font-bold text-slate-950 dark:text-white">
        {messages.clinicDashboardHeading}
      </h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300" role="status">
        {messages.loadingClinicDashboard}
      </p>
      <div aria-hidden="true" className="mt-6 grid gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div
            className="h-36 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"
            key={item}
          />
        ))}
      </div>
    </section>
  );
}
