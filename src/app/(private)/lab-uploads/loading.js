import { getTranslations } from "@/i18n/translations";
import { getRequestPreferences } from "@/server/preferences/current";

export default async function LabUploadsLoading() {
  const { language } = await getRequestPreferences();
  const messages = getTranslations(language);

  return (
    <section aria-live="polite">
      <h1 className="text-3xl font-bold text-slate-950 dark:text-white">
        {messages.labUploadsHeading}
      </h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300" role="status">
        {messages.loadingLabImports}
      </p>
      <div
        aria-hidden="true"
        className="mt-8 h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"
      />
    </section>
  );
}
