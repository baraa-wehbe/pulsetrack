import Link from "next/link";

import { getTranslations } from "@/i18n/translations";
import { prisma } from "@/lib/prisma";
import { listActivePatients } from "@/server/patients/service";
import { getRequestPreferences } from "@/server/preferences/current";

export const metadata = {
  title: "Patients | PulseTrack",
};

const sexLabel = (messages, sex) =>
  ({
    MALE: messages.sexMale,
    FEMALE: messages.sexFemale,
    OTHER: messages.sexOther,
    UNKNOWN: messages.sexUnknown,
  })[sex];

export default async function PatientsPage() {
  const [{ language }, patients] = await Promise.all([
    getRequestPreferences(),
    listActivePatients(prisma),
  ]);
  const messages = getTranslations(language);

  return (
    <section aria-labelledby="patients-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">
            {messages.brand}
          </p>
          <h1
            className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white"
            id="patients-heading"
          >
            {messages.patientsHeading}
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            {messages.patientsDescription}
          </p>
        </div>
        <Link
          className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500"
          href="/patients/new"
        >
          {messages.newPatient}
        </Link>
      </div>

      {patients.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {messages.noPatientsTitle}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600 dark:text-slate-300">
            {messages.noPatientsDescription}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 space-y-3 md:hidden">
            {patients.map((patient) => (
              <article
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                key={patient.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate font-bold text-slate-950 dark:text-white">
                      {patient.firstName} {patient.lastName}
                    </h2>
                    <p
                      className="mt-1 text-sm text-slate-500 dark:text-slate-400"
                      dir="ltr"
                    >
                      {messages.mrn}: {patient.mrn}
                    </p>
                  </div>
                  <Link
                    aria-label={`${messages.viewDetails}: ${patient.firstName} ${patient.lastName}`}
                    className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    href={`/patients/${patient.id}`}
                  >
                    {messages.viewDetails}
                  </Link>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">
                      {messages.dateOfBirth}
                    </dt>
                    <dd className="mt-1 font-medium" dir="ltr">
                      {patient.dateOfBirth}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">
                      {messages.biologicalSex}
                    </dt>
                    <dd className="mt-1 font-medium">
                      {sexLabel(messages, patient.sex)}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <div className="mt-8 hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                {messages.patientListCaption}
              </caption>
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                <tr>
                  <th
                    className="px-5 py-3 text-start font-semibold"
                    scope="col"
                  >
                    {messages.name}
                  </th>
                  <th
                    className="px-5 py-3 text-start font-semibold"
                    scope="col"
                  >
                    {messages.mrn}
                  </th>
                  <th
                    className="px-5 py-3 text-start font-semibold"
                    scope="col"
                  >
                    {messages.dateOfBirth}
                  </th>
                  <th
                    className="px-5 py-3 text-start font-semibold"
                    scope="col"
                  >
                    {messages.biologicalSex}
                  </th>
                  <th className="px-5 py-3 text-end font-semibold" scope="col">
                    {messages.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {patients.map((patient) => (
                  <tr key={patient.id}>
                    <th
                      className="px-5 py-4 text-start font-semibold text-slate-950 dark:text-white"
                      scope="row"
                    >
                      {patient.firstName} {patient.lastName}
                    </th>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      <span dir="ltr">{patient.mrn}</span>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      <span dir="ltr">{patient.dateOfBirth}</span>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {sexLabel(messages, patient.sex)}
                    </td>
                    <td className="px-5 py-4 text-end">
                      <Link
                        aria-label={`${messages.viewDetails}: ${patient.firstName} ${patient.lastName}`}
                        className="rounded-lg px-3 py-2 font-semibold text-teal-700 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:text-teal-300 dark:hover:bg-teal-950"
                        href={`/patients/${patient.id}`}
                      >
                        {messages.viewDetails}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
