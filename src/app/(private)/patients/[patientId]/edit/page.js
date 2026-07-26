import { notFound } from "next/navigation";

import PatientForm from "@/components/patient-form";
import { getTranslations } from "@/i18n/translations";
import {
  getLocalDateOnly,
  patientIdentifierRouteParamsSchema,
} from "@/lib/patient-validation";
import { prisma } from "@/lib/prisma";
import { getPatientByIdentifier } from "@/server/patients/service";
import { getRequestPreferences } from "@/server/preferences/current";

export const metadata = {
  title: "Edit patient | PulseTrack",
};

export default async function EditPatientPage({ params }) {
  const parsedParams = patientIdentifierRouteParamsSchema.safeParse(
    await params,
  );

  if (!parsedParams.success) {
    notFound();
  }

  const [{ language }, patient] = await Promise.all([
    getRequestPreferences(),
    getPatientByIdentifier(prisma, parsedParams.data.patientId),
  ]);

  if (!patient) {
    notFound();
  }

  if (patient.archivedAt) {
    notFound();
  }

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
        {messages.editPatient}
      </h1>
      <p className="mt-3 text-slate-600 dark:text-slate-300">
        {messages.editPatientDescription}
      </p>
      <PatientForm
        initialPatient={{
          mrn: patient.mrn,
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: patient.dateOfBirth,
          sex: patient.sex,
          email: patient.email,
          phone: patient.phone,
        }}
        messages={messages}
        mode="edit"
        today={getLocalDateOnly()}
      />
    </section>
  );
}
