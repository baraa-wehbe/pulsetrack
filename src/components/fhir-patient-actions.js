"use client";

import { useState } from "react";

export default function FhirPatientActions({
  configured,
  externallyOwned,
  messages,
  patientId,
}) {
  const [feedback, setFeedback] = useState("");
  const [pending, setPending] = useState(false);

  const invoke = async (method) => {
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch(
        `/api/private/fhir/patients/${encodeURIComponent(patientId)}`,
        { method, headers: { Accept: "application/json" } },
      );
      const body = await response.json();
      setFeedback(
        response.ok
          ? method === "POST"
            ? messages.fhirSyncQueued
            : (messages[`fhirRemote${body.remoteStatus}`] ??
              messages.fhirRemoteUnknown)
          : (body.error ?? messages.fhirActionError),
      );
    } catch {
      setFeedback(messages.fhirActionError);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {!externallyOwned && (
          <button
            className="rounded-full border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-50 dark:border-teal-400 dark:text-teal-200"
            disabled={!configured || pending}
            onClick={() => invoke("POST")}
            type="button"
          >
            {messages.syncPatient}
          </button>
        )}
        <button
          className="rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
          disabled={pending}
          onClick={() => invoke("GET")}
          type="button"
        >
          {messages.checkFhirStatus}
        </button>
      </div>
      {!configured && (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
          {messages.fhirNotConfiguredDescription}
        </p>
      )}
      {feedback && (
        <p
          aria-live="polite"
          className="mt-2 text-sm text-slate-600 dark:text-slate-300"
        >
          {feedback}
        </p>
      )}
    </div>
  );
}
