import RouteLoading from "@/components/route-loading";
import { getTranslations } from "@/i18n/translations";
import { getRequestPreferences } from "@/server/preferences/current";

export default async function AssessmentLoading() {
  const { language } = await getRequestPreferences();
  const messages = getTranslations(language);

  return (
    <main className="app-main mx-auto min-h-screen w-full max-w-4xl px-5 py-10 sm:px-8">
      <RouteLoading
        cards={4}
        compact
        status={messages.publicAssessmentLoading}
        title={messages.brand}
      />
    </main>
  );
}
