"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import InlineSpinner from "@/components/inline-spinner";

const ERROR_MESSAGE_KEYS = Object.freeze({
  FILE_REQUIRED: "labUploadFileRequired",
  CSV_REQUIRED: "labUploadCsvRequired",
  FILE_EMPTY: "labUploadEmpty",
  FILE_TOO_LARGE: "labUploadTooLarge",
  INVALID_HEADERS: "labUploadInvalidHeaders",
  INVALID_FORM: "labUploadInvalid",
});

export default function LabCsvUploadForm({ maximumBytes, messages }) {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setSuccess(null);

    if (!file) {
      setError(messages.labUploadFileRequired);
      return;
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError(messages.labUploadCsvRequired);
      return;
    }
    if (file.size === 0) {
      setError(messages.labUploadEmpty);
      return;
    }
    if (file.size > maximumBytes) {
      setError(messages.labUploadTooLarge);
      return;
    }

    setPending(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/private/lab-imports", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        const messageKey = ERROR_MESSAGE_KEYS[result.code];
        setError(messageKey ? messages[messageKey] : messages.labUploadError);
        return;
      }

      form.reset();
      setFile(null);
      const imported = result.labImport;
      if (imported?.id) {
        const filter =
          imported.rejectedRows > 0
            ? "rejected"
            : imported.duplicateRows > 0
              ? "duplicate"
              : "all";
        setSuccess({
          ...imported,
          fileName: file.name,
          reportHref: `/lab-uploads/${encodeURIComponent(imported.id)}?status=${filter}`,
        });
      }
      router.refresh();
    } catch {
      setError(messages.labUploadError);
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="space-y-4" noValidate onSubmit={submit}>
      <div>
        <label
          className="block text-sm font-semibold text-slate-800 dark:text-slate-100"
          htmlFor="lab-csv-file"
        >
          {messages.labCsvFile}
        </label>
        <input
          accept=".csv,text/csv"
          aria-describedby="lab-csv-help lab-csv-error"
          aria-invalid={Boolean(error)}
          className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 file:me-3 file:rounded-full file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:font-semibold file:text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:file:bg-teal-950 dark:file:text-teal-200"
          id="lab-csv-file"
          name="file"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          required
          type="file"
        />
        <p
          className="mt-2 text-sm text-slate-500 dark:text-slate-400"
          id="lab-csv-help"
        >
          {messages.labCsvHelp}
        </p>
        {error && (
          <p
            className="mt-2 text-sm font-semibold text-red-700 dark:text-red-300"
            id="lab-csv-error"
            role="alert"
          >
            {error}
          </p>
        )}
        {success ? (
          <div
            aria-live="polite"
            className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-100"
            role="status"
          >
            <p className="font-bold">{messages.labUploadSuccessTitle}</p>
            <p className="mt-1 leading-6">
              {messages.labUploadSuccessDescription
                .replace("{file}", success.fileName)
                .replace("{accepted}", String(success.acceptedRows))
                .replace("{rejected}", String(success.rejectedRows))
                .replace("{duplicates}", String(success.duplicateRows))}
            </p>
            <p className="mt-1 leading-6">{messages.labUploadReportHint}</p>
            <Link
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3 py-2 font-bold text-white transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500"
              href={success.reportHref}
            >
              {messages.viewImportValidation}
              <svg
                aria-hidden="true"
                className="size-3.5"
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
            </Link>
          </div>
        ) : null}
      </div>
      <button
        aria-busy={pending}
        className="inline-flex items-center gap-2 rounded-full bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? <InlineSpinner /> : null}
        {pending ? messages.labUploading : messages.labUploadButton}
      </button>
    </form>
  );
}
