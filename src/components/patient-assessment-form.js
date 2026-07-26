"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createAssessmentRequestSchemaForDate } from "@/lib/assessment-validation";

const localTimestampToIso = (value) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : value;
};

export default function PatientAssessmentForm({ messages, mode, patient }) {
  const router = useRouter();
  const [scheduledFor, setScheduledFor] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  const isScheduled = mode === "SCHEDULED";
  const hasEmail = Boolean(patient.email);

  const submit = async (event) => {
    event.preventDefault();
    setFieldError("");
    setFormError("");

    const candidate = {
      deliveryMode: mode,
      scheduledFor: isScheduled ? localTimestampToIso(scheduledFor) : null,
    };
    const parsed = createAssessmentRequestSchemaForDate().safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues.find(
        ({ path }) => path[0] === "scheduledFor",
      );
      setFieldError(
        issue?.message === "past_schedule"
          ? messages.scheduleMustBeFuture
          : messages.scheduleInvalid,
      );
      return;
    }

    setPending(true);
    try {
      const response = await fetch(
        `/api/private/patients/${patient.id}/assessments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(candidate),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        setFormError(
          result.code === "PATIENT_EMAIL_REQUIRED"
            ? messages.patientEmailRequired
            : messages.assessmentCreationError,
        );
        return;
      }

      const outcome = result.delivered
        ? "sent"
        : result.scheduled
          ? "scheduled"
          : "failed";
      router.push(`/patients/${patient.id}?assessment=${outcome}`);
      router.refresh();
    } catch {
      setFormError(messages.assessmentCreationError);
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="mt-6 space-y-5" noValidate onSubmit={submit}>
      <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {messages.recipient}
        </p>
        <p className="mt-1 font-semibold text-slate-950 dark:text-white">
          {hasEmail ? (
            <bdi dir="ltr">{patient.email}</bdi>
          ) : (
            messages.notProvided
          )}
        </p>
      </div>

      {!hasEmail && (
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
          role="alert"
        >
          <p>{messages.patientEmailRequired}</p>
          <Link
            className="mt-2 inline-block font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2"
            href={`/patients/${patient.id}/edit`}
          >
            {messages.editPatient}
          </Link>
        </div>
      )}

      {isScheduled && (
        <div>
          <label
            className="block text-sm font-semibold text-slate-800 dark:text-slate-100"
            htmlFor="scheduledFor"
          >
            {messages.scheduledFor}
          </label>
          <input
            aria-describedby={fieldError ? "scheduledFor-error" : undefined}
            aria-invalid={Boolean(fieldError)}
            className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            id="scheduledFor"
            onChange={(event) => setScheduledFor(event.target.value)}
            required
            type="datetime-local"
            value={scheduledFor}
          />
          {fieldError && (
            <p
              className="mt-2 text-sm font-semibold text-red-700 dark:text-red-300"
              id="scheduledFor-error"
            >
              {fieldError}
            </p>
          )}
        </div>
      )}

      {formError && (
        <p
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          role="alert"
        >
          {formError}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending || !hasEmail}
          type="submit"
        >
          {pending
            ? messages.assessmentSubmitting
            : isScheduled
              ? messages.confirmSchedule
              : messages.confirmSend}
        </button>
        <Link
          className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          href={`/patients/${patient.id}`}
        >
          {messages.cancel}
        </Link>
      </div>
    </form>
  );
}
