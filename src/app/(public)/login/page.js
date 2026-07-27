import { redirect } from "next/navigation";

import LoginForm from "@/components/login-form";
import { getTranslations } from "@/i18n/translations";
import { getCurrentClinician } from "@/server/auth/current-clinician";
import { safeReturnPath } from "@/server/auth/validation";
import { getRequestPreferences } from "@/server/preferences/current";

export const metadata = {
  title: "Clinician login | PulseTrack",
};

export default async function LoginPage({ searchParams }) {
  const [clinician, preferences] = await Promise.all([
    getCurrentClinician(),
    getRequestPreferences(),
  ]);

  if (clinician) {
    redirect("/");
  }

  const messages = getTranslations(preferences.language);
  const parameters = await searchParams;
  const nextPath = safeReturnPath(parameters?.next);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
          {messages.clinicianLogin}
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {messages.loginDescription}
        </p>
        <LoginForm messages={messages} nextPath={nextPath} />
      </section>
    </main>
  );
}
