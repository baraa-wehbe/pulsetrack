import RouteLoading from "@/components/route-loading";
import { getTranslations } from "@/i18n/translations";
import { getRequestPreferences } from "@/server/preferences/current";

export default async function LabImportDetailLoading() {
  const { language } = await getRequestPreferences();
  const messages = getTranslations(language);

  return (
    <RouteLoading
      cards={3}
      status={messages.loadingLabImportDetail}
      title={messages.labImportValidation}
    />
  );
}
