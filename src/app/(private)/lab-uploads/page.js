import LabCsvUploadForm from "@/components/lab-csv-upload-form";
import LabImportReportLink from "@/components/lab-import-report-link";
import { STATUS_BADGE_RADIUS_CLASS } from "@/components/badge-styles";
import PageHeader from "@/components/page-header";
import { env } from "@/config/env.mjs";
import { getTranslations } from "@/i18n/translations";
import { getLabImportStatusPresentation } from "@/lib/lab-import-presentation";
import { prisma } from "@/lib/prisma";
import { requireCurrentClinician } from "@/server/auth/current-clinician";
import { listLabImports } from "@/server/labs/service";
import { getRequestPreferences } from "@/server/preferences/current";

export const metadata = {
  title: "Lab Uploads | PulseTrack",
};

const formatTimestamp = (value, language) =>
  new Intl.DateTimeFormat(language === "ar" ? "ar-LB" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const StatusBadge = ({ messages, status }) => {
  const presentation = getLabImportStatusPresentation(status);

  return (
    <span
      className={`inline-flex border px-2.5 py-1 text-xs font-bold ${STATUS_BADGE_RADIUS_CLASS} ${presentation.className}`}
    >
      {messages[presentation.translationKey]}
    </span>
  );
};

export default async function LabUploadsPage() {
  const [clinician, { language }] = await Promise.all([
    requireCurrentClinician(),
    getRequestPreferences(),
  ]);
  const imports = await listLabImports(prisma, clinician.id);
  const messages = getTranslations(language);

  return (
    <section aria-labelledby="lab-uploads-heading">
      <PageHeader
        description={messages.labUploadsDescription}
        descriptionClassName="max-w-3xl"
        headingId="lab-uploads-heading"
        title={messages.labUploadsHeading}
      />

      <section
        aria-labelledby="upload-lab-csv-heading"
        className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid lg:grid-cols-2">
          <div className="p-6 sm:p-8 lg:border-e lg:border-slate-200 dark:lg:border-slate-800">
            <h2
              className="text-xl font-bold text-slate-950 dark:text-white"
              id="upload-lab-csv-heading"
            >
              {messages.uploadLabCsv}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {messages.uploadLabCsvDescription}
            </p>
            <div className="mt-6">
              <LabCsvUploadForm
                maximumBytes={env.LAB_CSV_MAX_BYTES}
                messages={messages}
              />
            </div>
          </div>

          <div className="flex min-h-full flex-col justify-between border-t border-slate-200 bg-gradient-to-br from-teal-50 to-cyan-50/40 p-6 sm:p-8 lg:border-t-0 dark:border-slate-800 dark:from-teal-950/50 dark:to-slate-900">
            <div>
              <span
                aria-hidden="true"
                className="grid size-12 place-items-center rounded-2xl bg-teal-700 text-white shadow-sm dark:bg-teal-600"
              >
                <svg className="size-6" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </span>
              <h2 className="mt-5 text-xl font-bold text-slate-950 dark:text-white">
                {messages.labTemplateHeading}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {messages.labTemplateDescription}
              </p>
            </div>
            <a
              className="control-pill mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500"
              download
              href="/api/private/lab-imports/template"
            >
              {messages.downloadLabTemplate}
            </a>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="lab-import-history-heading"
        className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <h2
          className="text-xl font-bold text-slate-950 dark:text-white"
          id="lab-import-history-heading"
        >
          {messages.labImportHistory}
        </h2>

        {imports.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
            <h3 className="font-bold text-slate-950 dark:text-white">
              {messages.noLabImports}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {messages.noLabImportsDescription}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-5 hidden rounded-xl border border-slate-200 md:block dark:border-slate-700">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">
                  {messages.labImportHistory}
                </caption>
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th
                      className="bg-teal-100/80 px-4 py-3 text-center font-bold text-teal-900 dark:bg-teal-950/70 dark:text-teal-200"
                      scope="col"
                    >
                      {messages.fileName}
                    </th>
                    <th className="px-4 py-3 text-center" scope="col">
                      {messages.uploadedAt}
                    </th>
                    <th className="px-4 py-3 text-center" scope="col">
                      {messages.rowCount}
                    </th>
                    <th className="px-4 py-3 text-center" scope="col">
                      {messages.acceptedRows}
                    </th>
                    <th className="px-4 py-3 text-center" scope="col">
                      {messages.rejectedRows}
                    </th>
                    <th className="px-4 py-3 text-center" scope="col">
                      {messages.duplicateRows}
                    </th>
                    <th className="px-4 py-3 text-center" scope="col">
                      {messages.status}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map((labImport) => (
                    <tr
                      className="border-t border-slate-200 dark:border-slate-700"
                      key={labImport.id}
                    >
                      <td className="max-w-xs break-words px-4 py-3 text-center font-semibold">
                        <LabImportReportLink
                          labImport={labImport}
                          messages={messages}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {formatTimestamp(labImport.createdAt, language)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {labImport.totalRows > 0
                          ? labImport.totalRows
                          : messages.notAvailable}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {labImport.acceptedRows}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {labImport.rejectedRows}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {labImport.duplicateRows}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge
                          messages={messages}
                          status={labImport.status}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="mt-5 space-y-3 md:hidden">
              {imports.map((labImport) => (
                <li
                  className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                  key={labImport.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <LabImportReportLink
                      labImport={labImport}
                      messages={messages}
                    />
                    <StatusBadge
                      messages={messages}
                      status={labImport.status}
                    />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">
                        {messages.uploadedAt}
                      </dt>
                      <dd>{formatTimestamp(labImport.createdAt, language)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">
                        {messages.rowCount}
                      </dt>
                      <dd>
                        {labImport.totalRows > 0
                          ? labImport.totalRows
                          : messages.notAvailable}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">
                        {messages.acceptedRows}
                      </dt>
                      <dd>{labImport.acceptedRows}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">
                        {messages.rejectedRows}
                      </dt>
                      <dd>{labImport.rejectedRows}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">
                        {messages.duplicateRows}
                      </dt>
                      <dd>{labImport.duplicateRows}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </section>
  );
}
