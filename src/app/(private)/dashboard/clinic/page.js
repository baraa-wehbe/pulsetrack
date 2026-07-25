import PlaceholderPage from "@/components/placeholder-page";
import { getTranslations } from "@/i18n/translations";
import { getRequestPreferences } from "@/server/preferences/current";

export const metadata = {
  title: "Clinic Dashboard | PulseTrack",
};

export default async function ClinicDashboardPage() {
  const { language } = await getRequestPreferences();
  const messages = getTranslations(language);

  return (
    <PlaceholderPage
      description={messages.clinicDashboardDescription}
      eyebrow={messages.dashboard}
      title={messages.clinicDashboardHeading}
    />
  );
}
