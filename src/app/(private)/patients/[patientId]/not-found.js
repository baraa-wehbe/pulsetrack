import Link from "next/link";

import { getTranslations } from "@/i18n/translations";
import { getRequestPreferences } from "@/server/preferences/current";

export default async function PatientNotFound() {
  const { language } = await getRequestPreferences();
  const messages = getTranslations(language);

  return (
    <section
      aria-labelledby="patient-not-found-heading"
      className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900"
    >
      <h1
        className="text-2xl font-bold text-slate-950 dark:text-white"
        id="patient-not-found-heading"
      >
        {messages.patientNotFoundTitle}
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-300">
        {messages.patientNotFoundDescription}
      </p>
      <Link
        className="mt-6 inline-flex rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
        href="/patients"
      >
        {messages.backToPatients}
      </Link>
    </section>
  );
}
