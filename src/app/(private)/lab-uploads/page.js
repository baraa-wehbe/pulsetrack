import PlaceholderPage from "@/components/placeholder-page";
import { getTranslations } from "@/i18n/translations";
import { getRequestPreferences } from "@/server/preferences/current";

export const metadata = {
  title: "Lab Uploads | PulseTrack",
};

export default async function LabUploadsPage() {
  const { language } = await getRequestPreferences();
  const messages = getTranslations(language);

  return (
    <PlaceholderPage
      description={messages.labUploadsDescription}
      eyebrow={messages.brand}
      title={messages.labUploadsHeading}
    />
  );
}
