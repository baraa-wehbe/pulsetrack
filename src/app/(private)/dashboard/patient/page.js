import PlaceholderPage from "@/components/placeholder-page";
import { getTranslations } from "@/i18n/translations";
import { getRequestPreferences } from "@/server/preferences/current";

export const metadata = {
  title: "Patient Dashboard | PulseTrack",
};

export default async function PatientDashboardPage() {
  const { language } = await getRequestPreferences();
  const messages = getTranslations(language);

  return (
    <PlaceholderPage
      description={messages.patientDashboardDescription}
      eyebrow={messages.dashboard}
      title={messages.patientDashboardHeading}
    />
  );
}
