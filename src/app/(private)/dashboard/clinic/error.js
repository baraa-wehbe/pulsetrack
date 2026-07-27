"use client";

import { useEffect, useRef } from "react";

import { getTranslations } from "@/i18n/translations";

const LocalizedText = ({ messageKey }) => (
  <>
    <span className="language-en">{getTranslations("en")[messageKey]}</span>
    <span className="language-ar" lang="ar">
      {getTranslations("ar")[messageKey]}
    </span>
  </>
);

export default function ClinicDashboardError({ reset }) {
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      className="rounded-2xl border border-red-200 bg-white p-8 dark:border-red-900 dark:bg-slate-900"
      role="alert"
    >
      <h1
        className="text-2xl font-bold text-slate-950 outline-none dark:text-white"
        ref={headingRef}
        tabIndex={-1}
      >
        <LocalizedText messageKey="clinicDashboardErrorTitle" />
      </h1>
      <p className="mt-3 text-slate-600 dark:text-slate-300">
        <LocalizedText messageKey="clinicDashboardErrorDescription" />
      </p>
      <button
        className="mt-6 rounded-full bg-teal-700 px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
        onClick={reset}
        type="button"
      >
        <LocalizedText messageKey="retry" />
      </button>
    </section>
  );
}
