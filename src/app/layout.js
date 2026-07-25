import "./globals.css";

import { getDocumentDirection } from "@/config/preferences";
import { getRequestPreferences } from "@/server/preferences/current";

export const metadata = {
  title: "PulseTrack",
  description: "Remote patient monitoring for clinicians and patients.",
};

export default async function RootLayout({ children }) {
  const { language, theme } = await getRequestPreferences();

  return (
    <html
      className={theme === "dark" ? "dark" : undefined}
      data-theme={theme}
      dir={getDocumentDirection(language)}
      lang={language}
    >
      <body className="min-h-screen bg-slate-50 text-slate-950 antialiased dark:bg-slate-950 dark:text-slate-50">
        {children}
      </body>
    </html>
  );
}
