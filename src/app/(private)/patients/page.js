import Link from "next/link";
import { redirect } from "next/navigation";

import PatientBadge from "@/components/patient-badge";
import { getTranslations } from "@/i18n/translations";
import {
  buildPatientListHref,
  PATIENT_BADGE_MAPPINGS,
} from "@/lib/patient-list";
import {
  parsePatientListPageQuery,
  PATIENT_ORIGIN_VALUES,
  PATIENT_OWNERSHIP_VALUES,
  PATIENT_PAGE_SIZE_VALUES,
  PATIENT_SYNC_STATUS_VALUES,
} from "@/lib/patient-validation";
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

const filterLabel = (messages, kind, value) =>
  value === "all"
    ? messages.allOptions
    : messages[PATIENT_BADGE_MAPPINGS[kind][value].translationKey];

const PatientActions = ({ messages, patient }) => (
  <div className="flex flex-wrap justify-end gap-2">
    <Link
      aria-label={`${messages.sendQuestionnaireTo} ${patient.mrn}`}
      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      href={`/patients/${patient.id}/send`}
    >
      {messages.send}
    </Link>
    <Link
      aria-label={`${messages.scheduleQuestionnaireFor} ${patient.mrn}`}
      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      href={`/patients/${patient.id}/schedule`}
    >
      {messages.schedule}
    </Link>
  </div>
);

const MrnLink = ({ messages, patient }) => (
  <Link
    aria-label={`${messages.viewPatientMrn} ${patient.mrn}`}
    className="font-semibold text-teal-700 underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:text-teal-300"
    href={`/patients/${patient.id}`}
  >
    <bdi dir="ltr">{patient.mrn}</bdi>
  </Link>
);

const Pagination = ({ messages, pagination, query }) => (
  <nav
    aria-label={messages.patientPagination}
    className="mt-6 flex flex-wrap items-center justify-between gap-4"
  >
    <p
      aria-live="polite"
      className="text-sm text-slate-600 dark:text-slate-300"
    >
      {messages.page} {pagination.page} {messages.of} {pagination.totalPages}
      {" · "}
      {pagination.totalCount} {messages.results}
    </p>
    <div className="flex gap-2">
      {pagination.hasPreviousPage ? (
        <Link
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:hover:bg-slate-800"
          href={buildPatientListHref(query, {
            page: pagination.page - 1,
          })}
          rel="prev"
        >
          {messages.previous}
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="cursor-not-allowed rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-400 dark:border-slate-800 dark:text-slate-600"
        >
          {messages.previous}
        </span>
      )}
      {pagination.hasNextPage ? (
        <Link
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:hover:bg-slate-800"
          href={buildPatientListHref(query, {
            page: pagination.page + 1,
          })}
          rel="next"
        >
          {messages.next}
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="cursor-not-allowed rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-400 dark:border-slate-800 dark:text-slate-600"
        >
          {messages.next}
        </span>
      )}
    </div>
  </nav>
);

export default async function PatientsPage({ searchParams }) {
  const rawQuery = await searchParams;
  const query = parsePatientListPageQuery(rawQuery);
  const [{ language }, result] = await Promise.all([
    getRequestPreferences(),
    listActivePatients(prisma, query),
  ]);
  const messages = getTranslations(language);

  if (result.pagination.page !== query.page) {
    redirect(buildPatientListHref(query, { page: result.pagination.page }));
  }

  const isFiltered =
    query.search ||
    query.origin !== "all" ||
    query.ownership !== "all" ||
    query.syncStatus !== "all";

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

      <form
        action="/patients"
        className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        method="get"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <div className="sm:col-span-2">
            <label
              className="block text-sm font-semibold"
              htmlFor="patient-search"
            >
              {messages.searchPatients}
            </label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:bg-slate-950"
              defaultValue={query.search}
              id="patient-search"
              maxLength={100}
              name="search"
              placeholder={messages.searchPatientsPlaceholder}
              type="search"
            />
          </div>
          {[
            ["origin", messages.origin, PATIENT_ORIGIN_VALUES],
            ["ownership", messages.ownership, PATIENT_OWNERSHIP_VALUES],
            ["syncStatus", messages.syncStatus, PATIENT_SYNC_STATUS_VALUES],
          ].map(([name, label, values]) => (
            <div key={name}>
              <label
                className="block text-sm font-semibold"
                htmlFor={`patient-${name}`}
              >
                {label}
              </label>
              <select
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:bg-slate-950"
                defaultValue={query[name]}
                id={`patient-${name}`}
                name={name}
              >
                <option value="all">{messages.allOptions}</option>
                {values.map((value) => (
                  <option key={value} value={value}>
                    {filterLabel(messages, name, value)}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div>
            <label
              className="block text-sm font-semibold"
              htmlFor="patient-page-size"
            >
              {messages.pageSize}
            </label>
            <select
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:bg-slate-950"
              defaultValue={String(query.pageSize)}
              id="patient-page-size"
              name="pageSize"
            >
              {PATIENT_PAGE_SIZE_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
            type="submit"
          >
            {messages.applyFilters}
          </button>
          <Link
            className="rounded-lg px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:text-teal-300 dark:hover:bg-teal-950"
            href="/patients"
          >
            {messages.clearFilters}
          </Link>
        </div>
      </form>

      {result.patients.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isFiltered
              ? messages.noMatchingPatientsTitle
              : messages.noPatientsTitle}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600 dark:text-slate-300">
            {isFiltered
              ? messages.noMatchingPatientsDescription
              : messages.noPatientsDescription}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {isFiltered && (
              <Link
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700"
                href="/patients"
              >
                {messages.clearFilters}
              </Link>
            )}
            <Link
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
              href="/patients/new"
            >
              {messages.newPatient}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-8 space-y-4 xl:hidden">
            {result.patients.map((patient) => (
              <article
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                key={patient.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <MrnLink messages={messages} patient={patient} />
                    <h2 className="mt-1 break-words font-bold text-slate-950 dark:text-white">
                      {patient.firstName} {patient.lastName}
                    </h2>
                  </div>
                  <PatientActions messages={messages} patient={patient} />
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">
                      {messages.patientDetails}
                    </dt>
                    <dd className="mt-1">
                      <bdi dir="ltr">{patient.dateOfBirth}</bdi>
                      {" · "}
                      {sexLabel(messages, patient.sex)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">
                      {messages.contact}
                    </dt>
                    <dd className="mt-1 break-all">
                      <bdi dir="ltr">
                        {patient.email ?? patient.phone ?? messages.notProvided}
                      </bdi>
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <PatientBadge
                    kind="origin"
                    messages={messages}
                    value={patient.origin}
                  />
                  <PatientBadge
                    kind="ownership"
                    messages={messages}
                    value={patient.fhirOwnership}
                  />
                  <PatientBadge
                    kind="syncStatus"
                    messages={messages}
                    value={patient.fhirSyncStatus}
                  />
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:block dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full table-fixed border-collapse text-sm">
              <caption className="sr-only">
                {messages.patientListCaption}
              </caption>
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                <tr>
                  {[
                    messages.mrn,
                    messages.name,
                    messages.patientDetails,
                    messages.origin,
                    messages.ownership,
                    messages.syncStatus,
                  ].map((heading) => (
                    <th
                      className="px-3 py-3 text-start font-semibold"
                      key={heading}
                      scope="col"
                    >
                      {heading}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-end font-semibold" scope="col">
                    {messages.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {result.patients.map((patient) => (
                  <tr key={patient.id}>
                    <td className="px-3 py-4">
                      <MrnLink messages={messages} patient={patient} />
                    </td>
                    <th
                      className="break-words px-3 py-4 text-start font-semibold text-slate-950 dark:text-white"
                      scope="row"
                    >
                      {patient.firstName} {patient.lastName}
                    </th>
                    <td className="px-3 py-4 text-slate-600 dark:text-slate-300">
                      <bdi dir="ltr">{patient.dateOfBirth}</bdi>
                      <span className="block">
                        {sexLabel(messages, patient.sex)}
                      </span>
                      <bdi className="block break-all" dir="ltr">
                        {patient.email ?? patient.phone ?? messages.notProvided}
                      </bdi>
                    </td>
                    <td className="px-3 py-4">
                      <PatientBadge
                        kind="origin"
                        messages={messages}
                        value={patient.origin}
                      />
                    </td>
                    <td className="px-3 py-4">
                      <PatientBadge
                        kind="ownership"
                        messages={messages}
                        value={patient.fhirOwnership}
                      />
                    </td>
                    <td className="px-3 py-4">
                      <PatientBadge
                        kind="syncStatus"
                        messages={messages}
                        value={patient.fhirSyncStatus}
                      />
                    </td>
                    <td className="px-3 py-4">
                      <PatientActions messages={messages} patient={patient} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            messages={messages}
            pagination={result.pagination}
            query={result.query}
          />
        </>
      )}
    </section>
  );
}
