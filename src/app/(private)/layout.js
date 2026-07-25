import AuthenticatedShell from "@/components/authenticated-shell";
import { getDocumentDirection } from "@/config/preferences";
import { getTranslations } from "@/i18n/translations";
import { requireCurrentClinician } from "@/server/auth/current-clinician";
import { getRequestPreferences } from "@/server/preferences/current";

export default async function PrivateLayout({ children }) {
  const [clinician, preferences] = await Promise.all([
    requireCurrentClinician(),
    getRequestPreferences(),
  ]);
  const messages = getTranslations(preferences.language);

  return (
    <AuthenticatedShell
      clinician={clinician}
      direction={getDocumentDirection(preferences.language)}
      language={preferences.language}
      messages={messages}
      theme={preferences.theme}
    >
      {children}
    </AuthenticatedShell>
  );
}
