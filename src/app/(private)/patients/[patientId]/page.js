import Link from "next/link";
import { notFound } from "next/navigation";

import ArchivePatientButton from "@/components/archive-patient-button";
import { getTranslations } from "@/i18n/translations";
import { patientRouteParamsSchema } from "@/lib/patient-validation";
import { prisma } from "@/lib/prisma";
import { getPatientById } from "@/server/patients/service";
import { getRequestPreferences } from "@/server/preferences/current";

export const metadata = {
  title: "Patient details | PulseTrack",
};

export default async function PatientDetailsPage({ params }) {
  const parsedParams = patientRouteParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    notFound();
  }

  const [{ language }, patient] = await Promise.all([
    getRequestPreferences(),
    getPatientById(prisma, parsedParams.data.patientId),
  ]);

  if (!patient) {
    notFound();
  }

  const messages = getTranslations(language);
  const sex = {
    MALE: messages.sexMale,
    FEMALE: messages.sexFemale,
    OTHER: messages.sexOther,
    UNKNOWN: messages.sexUnknown,
  }[patient.sex];
  const fields = [
    { label: messages.mrn, value: patient.mrn, ltr: true },
    { label: messages.dateOfBirth, value: patient.dateOfBirth, ltr: true },
    { label: messages.biologicalSex, value: sex },
    {
      label: messages.email,
      value: patient.email ?? messages.notProvided,
      ltr: Boolean(patient.email),
    },
    {
      label: messages.phone,
      value: patient.phone ?? messages.notProvided,
      ltr: Boolean(patient.phone),
    },
    {
      label: messages.status,
      value: patient.archivedAt ? messages.archived : messages.active,
    },
  ];

  return (
    <section aria-labelledby="patient-heading">
      <Link
        className="rounded-md text-sm font-semibold text-teal-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:text-teal-300"
        href="/patients"
      >
        {messages.backToPatients}
      </Link>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">
              {messages.patientDetails}
            </p>
            <h1
              className="mt-2 break-words text-3xl font-bold tracking-tight text-slate-950 dark:text-white"
              id="patient-heading"
            >
              {patient.firstName} {patient.lastName}
            </h1>
          </div>
          {!patient.archivedAt ? (
            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                href={`/patients/${patient.id}/edit`}
              >
                {messages.editPatient}
              </Link>
              <ArchivePatientButton
                messages={messages}
                patientId={patient.id}
              />
            </div>
          ) : null}
        </div>

        {patient.archivedAt ? (
          <p
            className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
            role="status"
          >
            {messages.archivedPatientNotice}
          </p>
        ) : null}

        <dl className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map(({ label, value, ltr }) => (
            <div
              className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70"
              key={label}
            >
              <dt className="text-sm text-slate-500 dark:text-slate-400">
                {label}
              </dt>
              <dd
                className="mt-1 break-words font-semibold text-slate-950 dark:text-white"
                dir={ltr ? "ltr" : undefined}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
