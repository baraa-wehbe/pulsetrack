import RouteLoading from "@/components/route-loading";
import { getTranslations } from "@/i18n/translations";
import { getRequestPreferences } from "@/server/preferences/current";

export default async function PatientsLoading() {
  const { language } = await getRequestPreferences();
  const messages = getTranslations(language);

  return (
    <RouteLoading
      cards={6}
      compact
      status={messages.loadingPatients}
      title={messages.patientsHeading}
    />
  );
}
