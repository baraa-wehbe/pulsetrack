import LabCsvUploadForm from "@/components/lab-csv-upload-form";
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
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${presentation.className}`}
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">
            {messages.brand}
          </p>
          <h1
            className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white"
            id="lab-uploads-heading"
          >
            {messages.labUploadsHeading}
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
            {messages.labUploadsDescription}
          </p>
        </div>
        <a
          className="rounded-lg border border-teal-700 px-4 py-2 font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-teal-400 dark:text-teal-200 dark:hover:bg-teal-950"
          download
          href="/api/private/lab-imports/template"
        >
          {messages.downloadLabTemplate}
        </a>
      </div>

      <section
        aria-labelledby="upload-lab-csv-heading"
        className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <h2
          className="text-xl font-bold text-slate-950 dark:text-white"
          id="upload-lab-csv-heading"
        >
          {messages.uploadLabCsv}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {messages.uploadLabCsvDescription}
        </p>
        <LabCsvUploadForm
          maximumBytes={env.LAB_CSV_MAX_BYTES}
          messages={messages}
        />
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
            <div className="mt-5 hidden overflow-hidden rounded-xl border border-slate-200 md:block dark:border-slate-700">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">
                  {messages.labImportHistory}
                </caption>
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-start" scope="col">
                      {messages.fileName}
                    </th>
                    <th className="px-4 py-3 text-start" scope="col">
                      {messages.uploadedAt}
                    </th>
                    <th className="px-4 py-3 text-start" scope="col">
                      {messages.rowCount}
                    </th>
                    <th className="px-4 py-3 text-start" scope="col">
                      {messages.acceptedRows}
                    </th>
                    <th className="px-4 py-3 text-start" scope="col">
                      {messages.rejectedRows}
                    </th>
                    <th className="px-4 py-3 text-start" scope="col">
                      {messages.duplicateRows}
                    </th>
                    <th className="px-4 py-3 text-start" scope="col">
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
                      <td className="max-w-xs break-words px-4 py-3 font-semibold">
                        <bdi dir="ltr">{labImport.originalFileName}</bdi>
                      </td>
                      <td className="px-4 py-3">
                        {formatTimestamp(labImport.createdAt, language)}
                      </td>
                      <td className="px-4 py-3">
                        {labImport.totalRows > 0
                          ? labImport.totalRows
                          : messages.notAvailable}
                      </td>
                      <td className="px-4 py-3">{labImport.acceptedRows}</td>
                      <td className="px-4 py-3">{labImport.rejectedRows}</td>
                      <td className="px-4 py-3">{labImport.duplicateRows}</td>
                      <td className="px-4 py-3">
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
                    <p className="min-w-0 break-words font-semibold">
                      <bdi dir="ltr">{labImport.originalFileName}</bdi>
                    </p>
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
