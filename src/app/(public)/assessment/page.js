import { cookies } from "next/headers";

import BrandMark from "@/components/brand-mark";
import PublicAssessmentForm from "@/components/public-assessment-form";
import { ASSESSMENT_ACCESS_COOKIE_NAME } from "@/config/assessment-access";
import { env } from "@/config/env.mjs";
import { getTranslations } from "@/i18n/translations";
import { prisma } from "@/lib/prisma";
import { verifyAssessmentAccessCredential } from "@/server/assessments/access";
import { loadPublicAssessment } from "@/server/assessments/public-service";
import { getRequestPreferences } from "@/server/preferences/current";

export const metadata = {
  title: "Assessment | PulseTrack",
};
export const dynamic = "force-dynamic";

const Unavailable = ({ messages }) => (
  <section
    className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"
    role="alert"
  >
    <h1 className="text-3xl font-bold text-slate-950 dark:text-white">
      {messages.publicAssessmentUnavailableTitle}
    </h1>
    <p className="mt-3 text-slate-600 dark:text-slate-300">
      {messages.publicAssessmentUnavailableDescription}
    </p>
  </section>
);

export default async function PublicAssessmentPage() {
  const [{ language }, cookieStore] = await Promise.all([
    getRequestPreferences(),
    cookies(),
  ]);
  const messages = getTranslations(language);
  const access = verifyAssessmentAccessCredential(
    cookieStore.get(ASSESSMENT_ACCESS_COOKIE_NAME)?.value,
    env.AUTH_SECRET,
  );
  if (!access) {
    return (
      <main className="app-main flex min-h-screen items-center justify-center px-5 py-10">
        <Unavailable messages={messages} />
      </main>
    );
  }

  let assessment;
  try {
    assessment = await loadPublicAssessment(prisma, access.assessmentId);
  } catch (error) {
    console.error("Public assessment loading failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }
  if (!assessment) {
    return (
      <main className="app-main flex min-h-screen items-center justify-center px-5 py-10">
        <Unavailable messages={messages} />
      </main>
    );
  }

  return (
    <main className="app-main mx-auto min-h-screen w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="brand-lockup mb-7">
          <BrandMark />
          <span className="font-black">{messages.brand}</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-950 dark:text-white">
          <bdi dir="auto">{assessment.questionnaire.title}</bdi>
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          <bdi dir="auto">{assessment.questionnaire.instructions}</bdi>
        </p>
        <p className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100">
          {messages.publicAssessmentPrivacyNotice}
        </p>
      </header>
      <section
        aria-label={messages.publicAssessmentQuestions}
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900"
      >
        <PublicAssessmentForm
          messages={messages}
          questionnaire={assessment.questionnaire}
        />
      </section>
    </main>
  );
}
