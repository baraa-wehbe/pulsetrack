import Link from "next/link";
import { notFound } from "next/navigation";

import { STATUS_BADGE_RADIUS_CLASS } from "@/components/badge-styles";
import { getTranslations } from "@/i18n/translations";
import {
  buildLabImportDetailHref,
  labImportRouteParamsSchema,
  parseLabRowFilter,
} from "@/lib/lab-import-detail";
import {
  getLabImportStatusPresentation,
  getLabRowStatusPresentation,
} from "@/lib/lab-import-presentation";
import { prisma } from "@/lib/prisma";
import { requireCurrentClinician } from "@/server/auth/current-clinician";
import { getLabImportDetail } from "@/server/labs/detail";
import { getRequestPreferences } from "@/server/preferences/current";

export const metadata = {
  title: "Lab import validation | PulseTrack",
};

const FIELD_MESSAGE_KEYS = Object.freeze({
  mrn: "labFieldMrn",
  collected_date: "labFieldCollectedDate",
  test_code: "labFieldTestCode",
  value: "labFieldValue",
});

const formatTimestamp = (value, language) =>
  new Intl.DateTimeFormat(language === "ar" ? "ar-LB" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const Badge = ({ messages, presentation }) => (
  <span
    className={`inline-flex border px-2.5 py-1 text-xs font-bold ${STATUS_BADGE_RADIUS_CLASS} ${presentation.className}`}
  >
    {messages[presentation.translationKey]}
  </span>
);

const ErrorList = ({ errors, messages }) =>
  errors.length === 0 ? (
    <span aria-label={messages.noValidationErrors}>—</span>
  ) : (
    <ul className="space-y-2">
      {errors.map((error, index) => {
        const fieldKey = FIELD_MESSAGE_KEYS[error.field];
        return (
          <li key={`${error.code}-${error.field ?? "row"}-${index}`}>
            <code className="break-all text-xs font-bold" dir="ltr">
              {error.code}
            </code>
            <span className="block text-xs text-slate-600 dark:text-slate-300">
              {fieldKey
                ? `${messages.validationField}: ${messages[fieldKey]}. `
                : ""}
              {messages[error.translationKey]}
            </span>
          </li>
        );
      })}
    </ul>
  );

export default async function LabImportDetailPage({ params, searchParams }) {
  const parsedParams = labImportRouteParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    notFound();
  }

  const query = await searchParams;
  const filter = parseLabRowFilter(query);
  const [clinician, { language }] = await Promise.all([
    requireCurrentClinician(),
    getRequestPreferences(),
  ]);
  const labImport = await getLabImportDetail(
    prisma,
    clinician.id,
    parsedParams.data.importId,
    filter,
  );
  if (!labImport) {
    notFound();
  }

  const messages = getTranslations(language);
  const importStatus = getLabImportStatusPresentation(labImport.status);
  const filters = [
    ["all", messages.allRows, labImport.totalRows],
    ["accepted", messages.acceptedRows, labImport.acceptedRows],
    ["rejected", messages.rejectedRows, labImport.rejectedRows],
    ["duplicate", messages.duplicateRows, labImport.duplicateRows],
  ];

  return (
    <section aria-labelledby="lab-import-detail-heading">
      <Link
        className="text-sm font-semibold text-teal-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:text-teal-300"
        href="/lab-uploads"
      >
        {messages.backToLabUploads}
      </Link>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <h1
              className="break-words text-3xl font-bold text-slate-950 dark:text-white"
              id="lab-import-detail-heading"
            >
              <bdi dir="ltr">{labImport.originalFileName}</bdi>
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {messages.uploadedAt}:{" "}
              {formatTimestamp(labImport.createdAt, language)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge messages={messages} presentation={importStatus} />
            <a
              className="control-pill rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
              download
              href={`/api/private/lab-imports/${encodeURIComponent(labImport.id)}/report`}
            >
              {messages.downloadValidationReport}
            </a>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            [messages.rowCount, labImport.totalRows],
            [messages.acceptedRows, labImport.acceptedRows],
            [messages.rejectedRows, labImport.rejectedRows],
            [messages.duplicateRows, labImport.duplicateRows],
          ].map(([label, value]) => (
            <div
              className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70"
              key={label}
            >
              <dt className="text-sm text-slate-500 dark:text-slate-400">
                {label}
              </dt>
              <dd className="mt-1 text-2xl font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <nav
        aria-label={messages.labRowFilters}
        className="mt-6 flex flex-wrap gap-2"
      >
        {filters.map(([value, label, count]) => (
          <Link
            aria-current={filter === value ? "page" : undefined}
            className={`control-pill rounded-full border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${
              filter === value
                ? "border-teal-700 bg-teal-700 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
            href={buildLabImportDetailHref(labImport.id, value)}
            key={value}
          >
            {label} ({count})
          </Link>
        ))}
      </nav>

      <section
        aria-labelledby="lab-import-rows-heading"
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2
          className="text-xl font-bold text-slate-950 dark:text-white"
          id="lab-import-rows-heading"
        >
          {messages.validationRows}
        </h2>

        {labImport.rows.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {messages.noRowsForFilter}
          </p>
        ) : (
          <>
            <div className="mt-5 hidden overflow-x-auto md:block">
              <table className="min-w-full border-collapse text-sm">
                <caption className="sr-only">{messages.validationRows}</caption>
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    {[
                      messages.csvRowNumber,
                      messages.status,
                      messages.mrn,
                      messages.labFieldCollectedDate,
                      messages.labFieldTestCode,
                      messages.labFieldValue,
                      messages.unit,
                      messages.validationErrors,
                    ].map((heading) => (
                      <th
                        className="px-3 py-3 text-start"
                        key={heading}
                        scope="col"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {labImport.rows.map((row) => (
                    <tr
                      className="border-t border-slate-200 align-top dark:border-slate-700"
                      key={row.rowNumber}
                    >
                      <td className="px-3 py-3">{row.rowNumber}</td>
                      <td className="px-3 py-3">
                        <Badge
                          messages={messages}
                          presentation={getLabRowStatusPresentation(row.status)}
                        />
                      </td>
                      <td className="px-3 py-3" dir="ltr">
                        {row.normalized.mrn ?? "—"}
                      </td>
                      <td className="px-3 py-3" dir="ltr">
                        {row.normalized.collectedDate ?? "—"}
                      </td>
                      <td className="px-3 py-3" dir="ltr">
                        {row.normalized.testCode ?? "—"}
                      </td>
                      <td className="px-3 py-3" dir="ltr">
                        {row.normalized.value ?? "—"}
                      </td>
                      <td className="px-3 py-3" dir="ltr">
                        {row.normalized.unit ?? "—"}
                      </td>
                      <td className="max-w-xs px-3 py-3">
                        <ErrorList errors={row.errors} messages={messages} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ol className="mt-5 space-y-3 md:hidden">
              {labImport.rows.map((row) => (
                <li
                  className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                  key={row.rowNumber}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-bold">
                      {messages.csvRowNumber} {row.rowNumber}
                    </h3>
                    <Badge
                      messages={messages}
                      presentation={getLabRowStatusPresentation(row.status)}
                    />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    {[
                      [messages.mrn, row.normalized.mrn],
                      [
                        messages.labFieldCollectedDate,
                        row.normalized.collectedDate,
                      ],
                      [messages.labFieldTestCode, row.normalized.testCode],
                      [messages.labFieldValue, row.normalized.value],
                      [messages.unit, row.normalized.unit],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-slate-500 dark:text-slate-400">
                          {label}
                        </dt>
                        <dd dir="ltr">{value ?? "—"}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-4">
                    <p className="text-sm font-semibold">
                      {messages.validationErrors}
                    </p>
                    <div className="mt-2">
                      <ErrorList errors={row.errors} messages={messages} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </section>
  );
}
