"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { CONTROL_RADIUS_CLASS } from "@/components/control-styles";
import { getTranslations } from "@/i18n/translations";

const LocalizedText = ({ messageKey }) => (
  <>
    <span className="language-en">{getTranslations("en")[messageKey]}</span>
    <span className="language-ar" lang="ar">
      {getTranslations("ar")[messageKey]}
    </span>
  </>
);

export default function PatientsError({ reset }) {
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby="patient-list-error-heading"
      className="rounded-2xl border border-red-200 bg-white p-8 dark:border-red-900 dark:bg-slate-900"
      role="alert"
    >
      <h1
        className="text-2xl font-bold text-slate-950 outline-none dark:text-white"
        id="patient-list-error-heading"
        ref={headingRef}
        tabIndex={-1}
      >
        <LocalizedText messageKey="patientListErrorTitle" />
      </h1>
      <p className="mt-3 text-slate-600 dark:text-slate-300">
        <LocalizedText messageKey="patientListErrorDescription" />
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className={`${CONTROL_RADIUS_CLASS} bg-teal-700 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600`}
          onClick={reset}
          type="button"
        >
          <LocalizedText messageKey="retry" />
        </button>
        <Link
          className={`${CONTROL_RADIUS_CLASS} border border-slate-300 px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700`}
          href="/"
        >
          <LocalizedText messageKey="backToWorkspace" />
        </Link>
      </div>
    </section>
  );
}
