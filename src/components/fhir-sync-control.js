"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function FhirSyncControl({ configured, messages }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [pending, setPending] = useState(false);

  const synchronize = async () => {
    setFeedback("");
    setPending(true);
    try {
      const response = await fetch("/api/private/fhir/synchronize", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const result = await response.json();
      if (!response.ok) {
        setFeedback(
          result.code === "NOT_CONFIGURED"
            ? messages.fhirNotConfiguredDescription
            : messages.fhirFullSyncError,
        );
        return;
      }

      setFeedback(
        messages.fhirFullSyncResult
          .replace("{imported}", String(result.imported.succeeded))
          .replace("{pushed}", String(result.pushed.succeeded))
          .replace(
            "{failed}",
            String(result.imported.failed + result.pushed.failed),
          ),
      );
      router.refresh();
    } catch {
      setFeedback(messages.fhirFullSyncError);
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <button
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-teal-700 px-5 py-3 text-base font-bold text-white shadow-sm transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-55 dark:bg-teal-700 dark:hover:bg-teal-600"
        disabled={!configured || pending}
        onClick={synchronize}
        type="button"
      >
        {pending ? messages.fhirSynchronizing : messages.synchronizeFhirData}
      </button>
      {feedback ? (
        <p
          className="mt-3 max-w-2xl text-sm font-medium text-slate-700 dark:text-slate-200"
          role="status"
        >
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
