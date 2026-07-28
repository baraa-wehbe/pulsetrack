import Link from "next/link";
import { redirect } from "next/navigation";

import AssessmentBadge from "@/components/assessment-badge";
import NewPatientModal from "@/components/new-patient-modal";
import PageHeader from "@/components/page-header";
import {
  PatientAssessmentActions,
  PatientAssessmentProvider,
} from "@/components/patient-assessment-actions";
import PatientBadge from "@/components/patient-badge";
import { CONTROL_RADIUS_CLASS } from "@/components/control-styles";
import PatientFilters from "@/components/patient-filters";
import { getDocumentDirection } from "@/config/preferences";
import { getTranslations } from "@/i18n/translations";
import {
  buildPatientDetailHref,
  buildPatientListHref,
} from "@/lib/patient-list";
import {
  getLocalDateOnly,
  parsePatientListPageQuery,
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

const newPatientButtonClass = `${CONTROL_RADIUS_CLASS} bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:bg-teal-700 dark:hover:bg-teal-600`;

const MrnLink = ({ listQuery, messages, patient }) => (
  <Link
    aria-label={`${messages.viewPatientMrn} ${patient.mrn}`}
    className="group relative inline-flex items-center gap-1.5 rounded-md bg-teal-50 px-2 py-1 font-bold text-teal-800 underline decoration-teal-400 decoration-dotted underline-offset-4 transition hover:bg-teal-100 hover:text-teal-950 hover:decoration-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:bg-teal-950/70 dark:text-teal-200 dark:hover:bg-teal-900"
    href={buildPatientDetailHref(patient.id, listQuery)}
  >
    <bdi dir="ltr">{patient.mrn}</bdi>
    <svg
      aria-hidden="true"
      className="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="M5 3h8v8M13 3 3 13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
    <span
      className="pointer-events-none absolute start-1/2 top-full z-20 mt-2 w-max max-w-48 -translate-x-1/2 rounded-lg bg-slate-950 px-2.5 py-1.5 text-center text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-white dark:text-slate-950"
      role="tooltip"
    >
      {messages.viewPatientDetailsTooltip}
    </span>
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
          className={`${CONTROL_RADIUS_CLASS} border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:hover:bg-slate-800`}
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
          className={`${CONTROL_RADIUS_CLASS} cursor-not-allowed border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-400 dark:border-slate-800 dark:text-slate-600`}
        >
          {messages.previous}
        </span>
      )}
      {pagination.hasNextPage ? (
        <Link
          className={`${CONTROL_RADIUS_CLASS} border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:hover:bg-slate-800`}
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
          className={`${CONTROL_RADIUS_CLASS} cursor-not-allowed border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-400 dark:border-slate-800 dark:text-slate-600`}
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
  const today = getLocalDateOnly();

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
        <PageHeader
          description={messages.patientsDescription}
          headingId="patients-heading"
          title={messages.patientsHeading}
        />
        <NewPatientModal
          messages={messages}
          today={today}
          triggerClassName={newPatientButtonClass}
        />
      </div>

      <PatientFilters
        direction={getDocumentDirection(language)}
        key={buildPatientListHref(query)}
        messages={messages}
        query={query}
      />

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
                className={`${CONTROL_RADIUS_CLASS} border border-slate-300 px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700`}
                href="/patients"
              >
                {messages.clearFilters}
              </Link>
            )}
            <NewPatientModal
              messages={messages}
              today={today}
              triggerClassName={newPatientButtonClass}
            />
          </div>
        </div>
      ) : (
        <PatientAssessmentProvider messages={messages}>
          <div className="mt-8 space-y-4 xl:hidden">
            {result.patients.map((patient) => (
              <article
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                key={patient.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <MrnLink
                      listQuery={result.query}
                      messages={messages}
                      patient={patient}
                    />
                    <h2 className="mt-1 break-words font-bold text-slate-950 dark:text-white">
                      {patient.firstName} {patient.lastName}
                    </h2>
                  </div>
                  <PatientAssessmentActions patient={patient} />
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
                  <AssessmentBadge
                    kind="status"
                    messages={messages}
                    value={patient.assessmentStatus}
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
                  <th
                    className="bg-teal-100/80 px-3 py-3 text-center font-bold text-teal-900 dark:bg-teal-950/70 dark:text-teal-200"
                    scope="col"
                  >
                    {messages.mrn}
                  </th>
                  {[
                    messages.name,
                    messages.patientDetails,
                    messages.origin,
                    messages.ownership,
                    messages.assessmentStatus,
                  ].map((heading) => (
                    <th
                      className="px-3 py-3 text-center font-semibold"
                      key={heading}
                      scope="col"
                    >
                      {heading}
                    </th>
                  ))}
                  <th
                    className="px-3 py-3 text-center font-semibold"
                    scope="col"
                  >
                    {messages.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {result.patients.map((patient) => (
                  <tr key={patient.id}>
                    <td className="px-3 py-4 text-center">
                      <MrnLink
                        listQuery={result.query}
                        messages={messages}
                        patient={patient}
                      />
                    </td>
                    <th
                      className="break-words px-3 py-4 text-center font-semibold text-slate-950 dark:text-white"
                      scope="row"
                    >
                      {patient.firstName} {patient.lastName}
                    </th>
                    <td className="px-3 py-4 text-center text-slate-600 dark:text-slate-300">
                      <bdi dir="ltr">{patient.dateOfBirth}</bdi>
                      <span className="block">
                        {sexLabel(messages, patient.sex)}
                      </span>
                      <bdi className="block break-all" dir="ltr">
                        {patient.email ?? patient.phone ?? messages.notProvided}
                      </bdi>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <PatientBadge
                        kind="origin"
                        messages={messages}
                        value={patient.origin}
                      />
                    </td>
                    <td className="px-3 py-4 text-center">
                      <PatientBadge
                        kind="ownership"
                        messages={messages}
                        value={patient.fhirOwnership}
                      />
                    </td>
                    <td className="px-3 py-4 text-center">
                      <AssessmentBadge
                        kind="status"
                        messages={messages}
                        value={patient.assessmentStatus}
                      />
                    </td>
                    <td className="px-3 py-4 text-center">
                      <PatientAssessmentActions
                        align="center"
                        patient={patient}
                      />
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
        </PatientAssessmentProvider>
      )}
    </section>
  );
}
