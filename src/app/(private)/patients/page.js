import PlaceholderPage from "@/components/placeholder-page";
import { getTranslations } from "@/i18n/translations";
import { getRequestPreferences } from "@/server/preferences/current";

export const metadata = {
  title: "Patients | PulseTrack",
};

export default async function PatientsPage() {
  const { language } = await getRequestPreferences();
  const messages = getTranslations(language);

  return (
    <PlaceholderPage
      description={messages.patientsDescription}
      eyebrow={messages.brand}
      title={messages.patientsHeading}
    />
  );
}
