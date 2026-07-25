import PatientForm from "@/components/patient-form";
import { getTranslations } from "@/i18n/translations";
import { getLocalDateOnly } from "@/lib/patient-validation";
import { getRequestPreferences } from "@/server/preferences/current";

export const metadata = {
  title: "New patient | PulseTrack",
};

export default async function NewPatientPage() {
  const { language } = await getRequestPreferences();
  const messages = getTranslations(language);

  return (
    <section
      aria-labelledby="page-heading"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900"
    >
      <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">
        {messages.patients}
      </p>
      <h1
        className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white"
        id="page-heading"
      >
        {messages.createPatientHeading}
      </h1>
      <p className="mt-3 text-slate-600 dark:text-slate-300">
        {messages.createPatientDescription}
      </p>
      <PatientForm
        messages={messages}
        mode="create"
        today={getLocalDateOnly()}
      />
    </section>
  );
}
