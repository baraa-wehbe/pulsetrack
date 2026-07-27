"use client";

import Link from "next/link";
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

export default function LabImportDetailError({ reset }) {
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
        <LocalizedText messageKey="labImportDetailErrorTitle" />
      </h1>
      <p className="mt-3 text-slate-600 dark:text-slate-300">
        <LocalizedText messageKey="labImportDetailErrorDescription" />
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className="rounded-full bg-teal-700 px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
          onClick={reset}
          type="button"
        >
          <LocalizedText messageKey="retry" />
        </button>
        <Link
          className="control-pill rounded-full border border-slate-300 px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700"
          href="/lab-uploads"
        >
          <LocalizedText messageKey="backToLabUploads" />
        </Link>
      </div>
    </section>
  );
}
