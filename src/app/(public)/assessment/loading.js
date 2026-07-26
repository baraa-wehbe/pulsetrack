import { getTranslations } from "@/i18n/translations";
import { getRequestPreferences } from "@/server/preferences/current";

export default async function AssessmentLoading() {
  const { language } = await getRequestPreferences();
  const messages = getTranslations(language);

  return (
    <main
      aria-live="polite"
      className="mx-auto min-h-screen w-full max-w-4xl px-5 py-10 sm:px-8"
      role="status"
    >
      <p className="font-semibold text-slate-700 dark:text-slate-200">
        {messages.publicAssessmentLoading}
      </p>
      <div
        aria-hidden="true"
        className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="h-28 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
            key={index}
          />
        ))}
      </div>
    </main>
  );
}
