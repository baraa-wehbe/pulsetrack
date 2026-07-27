import RouteLoading from "@/components/route-loading";
import { getTranslations } from "@/i18n/translations";
import { getRequestPreferences } from "@/server/preferences/current";

export default async function FhirSyncLoading() {
  const { language } = await getRequestPreferences();
  const messages = getTranslations(language);

  return (
    <RouteLoading
      cards={4}
      compact
      status={messages.fhirSynchronizing}
      title={messages.fhirSyncHeading}
    />
  );
}
