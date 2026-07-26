"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

export default function ArchivePatientButton({ messages, patientIdentifier }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const archive = async () => {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/private/patients/${encodeURIComponent(patientIdentifier)}/archive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );

      if (!response.ok) {
        throw new Error("Archive failed.");
      }

      window.location.assign("/patients");
    } catch {
      setError(messages.archiveError);
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root onOpenChange={setOpen} open={open}>
      <Dialog.Trigger asChild>
        <button
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
          type="button"
        >
          {messages.archivePatient}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed start-1/2 top-1/2 z-50 w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl outline-none rtl:translate-x-1/2 dark:border-slate-700 dark:bg-slate-900">
          <Dialog.Title className="text-xl font-bold text-slate-950 dark:text-white">
            {messages.archivePatientTitle}
          </Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {messages.archivePatientDescription}
          </Dialog.Description>
          {error ? (
            <p
              className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Dialog.Close asChild>
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                disabled={submitting}
                type="button"
              >
                {messages.cancel}
              </button>
            </Dialog.Close>
            <button
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-wait disabled:opacity-60"
              disabled={submitting}
              onClick={archive}
              type="button"
            >
              {submitting ? messages.archiving : messages.confirmArchive}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
