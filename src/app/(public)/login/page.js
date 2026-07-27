import { redirect } from "next/navigation";

import BrandMark from "@/components/brand-mark";
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
    <main className="app-main grid min-h-screen place-items-center px-4 py-8 sm:px-6">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white/95 shadow-[0_28px_80px_rgb(16_67_70_/_0.14)] backdrop-blur-xl md:grid-cols-[0.92fr_1.08fr] dark:border-slate-800 dark:bg-slate-900/95">
        <div className="relative hidden min-h-[36rem] overflow-hidden bg-teal-900 p-10 text-white md:flex md:flex-col md:justify-between">
          <div
            aria-hidden="true"
            className="absolute -end-24 -top-24 size-72 rounded-full border border-white/10"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-20 -start-20 size-64 rounded-full bg-cyan-300/10 blur-2xl"
          />
          <div className="relative">
            <div className="inline-flex items-center gap-3">
              <BrandMark className="border-white/20 bg-white/10 text-teal-100" />
              <span className="text-xl font-black tracking-tight">
                {messages.brand}
              </span>
            </div>
            <div className="mt-20 max-w-sm">
              <svg
                aria-hidden="true"
                className="h-16 w-52 text-teal-300"
                fill="none"
                viewBox="0 0 220 72"
              >
                <path
                  d="M2 39h38l12-26 23 49 18-39 13 25 14-17 12 8h86"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                />
              </svg>
              <h2 className="mt-7 text-3xl font-black leading-tight tracking-tight">
                {messages.clinicianLogin}
              </h2>
              <p className="mt-4 leading-7 text-teal-50/75">
                {messages.loginDescription}
              </p>
            </div>
          </div>
          <div className="relative flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-200/70">
            <span className="size-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgb(110_231_183_/_0.8)]" />
            {messages.brand}
          </div>
        </div>

        <div className="p-6 sm:p-10 lg:p-14">
          <div className="brand-lockup md:hidden">
            <BrandMark />
            <span className="text-lg font-black">{messages.brand}</span>
          </div>
          <h1 className="mt-10 text-3xl font-black tracking-[-0.035em] text-slate-950 md:mt-0 dark:text-white">
            {messages.clinicianLogin}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {messages.loginDescription}
          </p>
          <LoginForm messages={messages} nextPath={nextPath} />
        </div>
      </section>
    </main>
  );
}
