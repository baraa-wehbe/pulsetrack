"use client";

import Link from "next/link";
import { useState } from "react";

import InlineSpinner from "@/components/inline-spinner";
import { DIALOG_FOOTER_CLASS } from "@/components/dialog-styles";
import { createAssessmentRequestSchemaForDate } from "@/lib/assessment-validation";

const localTimestampToIso = (value) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : value;
};

export default function PatientAssessmentForm({
  messages,
  mode,
  onCancel,
  onSuccess,
  patient,
}) {
  const [scheduledFor, setScheduledFor] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  const isScheduled = mode === "SCHEDULED";
  const hasEmail = Boolean(patient.email);
  const timeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || messages.utcTimezone;

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

      if (!result.delivered && !result.scheduled) {
        setFormError(messages.assessmentFailedNotice);
        return;
      }

      onSuccess(result.delivered ? "sent" : "scheduled");
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
            aria-describedby={`scheduledFor-timezone${
              fieldError ? " scheduledFor-error" : ""
            }`}
            aria-invalid={Boolean(fieldError)}
            className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            id="scheduledFor"
            onChange={(event) => setScheduledFor(event.target.value)}
            required
            type="datetime-local"
            value={scheduledFor}
          />
          <p
            className="mt-2 text-sm text-slate-600 dark:text-slate-300"
            id="scheduledFor-timezone"
          >
            {messages.scheduleTimezone.replace("{timezone}", timeZone)}
          </p>
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

      <div className={DIALOG_FOOTER_CLASS}>
        <button
          aria-busy={pending}
          className="inline-flex items-center gap-2 rounded-full bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending || !hasEmail}
          type="submit"
        >
          {pending ? <InlineSpinner /> : null}
          {pending
            ? messages.assessmentSubmitting
            : isScheduled
              ? messages.confirmSchedule
              : messages.confirmSend}
        </button>
        <button
          className="rounded-full border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          disabled={pending}
          onClick={onCancel}
          type="button"
        >
          {messages.cancel}
        </button>
      </div>
    </form>
  );
}
