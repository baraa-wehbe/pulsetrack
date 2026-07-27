"use client";

import Link from "next/link";
import { useState } from "react";

import { DIALOG_FOOTER_CLASS } from "@/components/dialog-styles";
import InlineSpinner from "@/components/inline-spinner";
import {
  createPatientSchemaForDate,
  getFieldErrors,
  normalizePatientEmail,
  normalizePatientMrn,
  PATIENT_SEX_VALUES,
} from "@/lib/patient-validation";

const FIELD_ORDER = [
  "mrn",
  "firstName",
  "lastName",
  "dateOfBirth",
  "sex",
  "email",
  "phone",
];

const ERROR_MESSAGE_KEYS = {
  required: "validationRequired",
  too_long: "validationTooLong",
  invalid_text: "validationInvalidText",
  invalid_mrn: "validationInvalidMrn",
  invalid_email: "validationInvalidEmail",
  invalid_phone: "validationInvalidPhone",
  invalid_date: "validationInvalidDate",
  future_date: "validationFutureDate",
  invalid_sex: "validationInvalidSex",
  mrn_conflict: "validationMrnConflict",
};

const errorMessage = (messages, code) =>
  messages[ERROR_MESSAGE_KEYS[code]] ?? messages.patientFormError;

const fieldDescription = (name, fieldErrors) =>
  fieldErrors[name] ? `${name}-hint ${name}-error` : `${name}-hint`;

export default function PatientForm({
  controlRadiusClass = "rounded-full",
  initialPatient,
  messages,
  mode,
  onCancel,
  onSuccess,
  today,
}) {
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const focusFirstError = (errors) => {
    const firstField = FIELD_ORDER.find((field) => errors[field]);

    if (firstField) {
      requestAnimationFrame(() => document.getElementById(firstField)?.focus());
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setFieldErrors({});
    setFormError("");

    const values = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = createPatientSchemaForDate(today).safeParse(values);

    if (!parsed.success) {
      const errors = getFieldErrors(parsed.error);
      setFieldErrors(errors);
      focusFirstError(errors);
      return;
    }

    setSubmitting(true);

    try {
      const endpoint =
        mode === "create"
          ? "/api/private/patients"
          : `/api/private/patients/${initialPatient.id}`;
      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await response.json();

      if (!response.ok) {
        const errors = body.fieldErrors ?? {};

        setFieldErrors(errors);
        setFormError(
          errors.mrn ? "" : (body.error ?? messages.patientFormError),
        );
        focusFirstError(errors);
        return;
      }

      if (onSuccess) {
        onSuccess(body.patient);
      } else {
        window.location.assign(`/patients/${body.patient.id}`);
      }
    } catch {
      setFormError(messages.patientFormError);
    } finally {
      setSubmitting(false);
    }
  };

  const initial = initialPatient ?? {};
  const sexLabels = {
    MALE: messages.sexMale,
    FEMALE: messages.sexFemale,
    OTHER: messages.sexOther,
    UNKNOWN: messages.sexUnknown,
  };
  const inputClass =
    "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 aria-invalid:border-red-600 aria-invalid:ring-1 aria-invalid:ring-red-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-teal-400 dark:focus:ring-teal-950 dark:aria-invalid:border-red-400";
  const labelClass =
    "block text-sm font-semibold text-slate-800 dark:text-slate-100";

  const renderError = (name) =>
    fieldErrors[name] ? (
      <p
        className="mt-1.5 text-sm text-red-700 dark:text-red-300"
        id={`${name}-error`}
      >
        {errorMessage(messages, fieldErrors[name])}
      </p>
    ) : null;

  return (
    <form className="mt-8 space-y-6" noValidate onSubmit={handleSubmit}>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="mrn">
            {messages.mrn}{" "}
            <span className="text-red-700 dark:text-red-300" aria-hidden="true">
              *
            </span>
          </label>
          <p
            className="mt-1 text-xs text-slate-500 dark:text-slate-400"
            id="mrn-hint"
          >
            {messages.requiredField}
          </p>
          <input
            aria-describedby={fieldDescription("mrn", fieldErrors)}
            aria-invalid={Boolean(fieldErrors.mrn)}
            className={inputClass}
            defaultValue={initial.mrn ?? ""}
            dir="ltr"
            id="mrn"
            maxLength={50}
            name="mrn"
            onBlur={(event) => {
              event.currentTarget.value = normalizePatientMrn(
                event.currentTarget.value,
              );
            }}
            required
            type="text"
          />
          {renderError("mrn")}
        </div>

        <div>
          <label className={labelClass} htmlFor="dateOfBirth">
            {messages.dateOfBirth}{" "}
            <span className="text-red-700 dark:text-red-300" aria-hidden="true">
              *
            </span>
          </label>
          <p
            className="mt-1 text-xs text-slate-500 dark:text-slate-400"
            id="dateOfBirth-hint"
          >
            {messages.requiredField}
          </p>
          <input
            aria-describedby={fieldDescription("dateOfBirth", fieldErrors)}
            aria-invalid={Boolean(fieldErrors.dateOfBirth)}
            className={inputClass}
            defaultValue={initial.dateOfBirth ?? ""}
            dir="ltr"
            id="dateOfBirth"
            max={today}
            name="dateOfBirth"
            required
            type="date"
          />
          {renderError("dateOfBirth")}
        </div>

        <div>
          <label className={labelClass} htmlFor="firstName">
            {messages.firstName}{" "}
            <span className="text-red-700 dark:text-red-300" aria-hidden="true">
              *
            </span>
          </label>
          <p
            className="mt-1 text-xs text-slate-500 dark:text-slate-400"
            id="firstName-hint"
          >
            {messages.requiredField}
          </p>
          <input
            aria-describedby={fieldDescription("firstName", fieldErrors)}
            aria-invalid={Boolean(fieldErrors.firstName)}
            className={inputClass}
            defaultValue={initial.firstName ?? ""}
            id="firstName"
            maxLength={100}
            name="firstName"
            required
            type="text"
          />
          {renderError("firstName")}
        </div>

        <div>
          <label className={labelClass} htmlFor="lastName">
            {messages.lastName}{" "}
            <span className="text-red-700 dark:text-red-300" aria-hidden="true">
              *
            </span>
          </label>
          <p
            className="mt-1 text-xs text-slate-500 dark:text-slate-400"
            id="lastName-hint"
          >
            {messages.requiredField}
          </p>
          <input
            aria-describedby={fieldDescription("lastName", fieldErrors)}
            aria-invalid={Boolean(fieldErrors.lastName)}
            className={inputClass}
            defaultValue={initial.lastName ?? ""}
            id="lastName"
            maxLength={100}
            name="lastName"
            required
            type="text"
          />
          {renderError("lastName")}
        </div>

        <div>
          <label className={labelClass} htmlFor="sex">
            {messages.biologicalSex}{" "}
            <span className="text-red-700 dark:text-red-300" aria-hidden="true">
              *
            </span>
          </label>
          <p
            className="mt-1 text-xs text-slate-500 dark:text-slate-400"
            id="sex-hint"
          >
            {messages.requiredField}
          </p>
          <select
            aria-describedby={fieldDescription("sex", fieldErrors)}
            aria-invalid={Boolean(fieldErrors.sex)}
            className={inputClass}
            defaultValue={initial.sex ?? ""}
            id="sex"
            name="sex"
            required
          >
            <option disabled value="">
              {messages.selectOption}
            </option>
            {PATIENT_SEX_VALUES.map((value) => (
              <option key={value} value={value}>
                {sexLabels[value]}
              </option>
            ))}
          </select>
          {renderError("sex")}
        </div>

        <div>
          <label className={labelClass} htmlFor="email">
            {messages.email}
          </label>
          <p
            className="mt-1 text-xs text-slate-500 dark:text-slate-400"
            id="email-hint"
          >
            {messages.optionalField}
          </p>
          <input
            aria-describedby={fieldDescription("email", fieldErrors)}
            aria-invalid={Boolean(fieldErrors.email)}
            className={inputClass}
            defaultValue={initial.email ?? ""}
            dir="ltr"
            id="email"
            maxLength={320}
            name="email"
            onBlur={(event) => {
              event.currentTarget.value = normalizePatientEmail(
                event.currentTarget.value,
              );
            }}
            type="email"
          />
          {renderError("email")}
        </div>

        <div>
          <label className={labelClass} htmlFor="phone">
            {messages.phone}
          </label>
          <p
            className="mt-1 text-xs text-slate-500 dark:text-slate-400"
            id="phone-hint"
          >
            {messages.optionalField}
          </p>
          <input
            aria-describedby={fieldDescription("phone", fieldErrors)}
            aria-invalid={Boolean(fieldErrors.phone)}
            className={inputClass}
            defaultValue={initial.phone ?? ""}
            dir="ltr"
            id="phone"
            maxLength={32}
            name="phone"
            type="tel"
          />
          {renderError("phone")}
        </div>
      </div>

      {formError ? (
        <p
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
          role="alert"
        >
          {formError}
        </p>
      ) : null}

      <div
        className={`${DIALOG_FOOTER_CLASS} border-t border-slate-200 pt-6 dark:border-slate-800`}
      >
        <button
          aria-busy={submitting}
          className={`${controlRadiusClass} inline-flex items-center gap-2 bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-wait disabled:opacity-60 dark:bg-teal-700 dark:hover:bg-teal-600`}
          disabled={submitting}
          type="submit"
        >
          {submitting ? <InlineSpinner /> : null}
          {submitting ? messages.savingPatient : messages.savePatient}
        </button>
        {onCancel ? (
          <button
            className={`${controlRadiusClass} border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800`}
            disabled={submitting}
            onClick={onCancel}
            type="button"
          >
            {messages.cancel}
          </button>
        ) : (
          <Link
            className={`${controlRadiusClass} border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800`}
            href={
              mode === "edit" ? `/patients/${initialPatient.id}` : "/patients"
            }
          >
            {messages.cancel}
          </Link>
        )}
      </div>
    </form>
  );
}
