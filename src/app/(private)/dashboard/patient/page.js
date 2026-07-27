import Link from "next/link";

import AssessmentBadge from "@/components/assessment-badge";
import { STATUS_BADGE_RADIUS_CLASS } from "@/components/badge-styles";
import PageHeader from "@/components/page-header";
import TimeSeriesChart from "@/components/time-series-chart";
import { getTranslations } from "@/i18n/translations";
import { parsePatientDashboardQuery } from "@/lib/patient-dashboard";
import { prisma } from "@/lib/prisma";
import {
  getPatientDashboardData,
  listPatientDashboardOptions,
} from "@/server/dashboards/patient";
import { getRequestPreferences } from "@/server/preferences/current";

export const metadata = {
  title: "Patient Dashboard | PulseTrack",
};

export const dynamic = "force-dynamic";

const formatValue = (value, language) =>
  new Intl.NumberFormat(language === "ar" ? "ar-LB" : "en-GB", {
    maximumFractionDigits: 2,
    signDisplay: value === 0 ? "auto" : "exceptZero",
  }).format(value);

const formatDate = (value, language) =>
  new Intl.DateTimeFormat(language === "ar" ? "ar-LB" : "en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));

const ReferenceBadge = ({ messages, state }) => {
  const presentation = {
    LOW: [
      messages.belowReference,
      "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
    ],
    IN_RANGE: [
      messages.inReferenceRange,
      "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
    ],
    HIGH: [
      messages.aboveReference,
      "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200",
    ],
  }[state];

  return presentation ? (
    <span
      className={`${STATUS_BADGE_RADIUS_CLASS} px-3 py-1 text-xs font-bold ${presentation[1]}`}
    >
      {presentation[0]}
    </span>
  ) : null;
};

const MetricSummary = ({
  language,
  messages,
  metric,
  questionnaire = false,
}) => {
  const { latest, previous, change, referenceState } = metric.summary;

  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
        <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {messages.latestValue}
        </dt>
        <dd className="mt-1 font-bold text-slate-950 dark:text-white">
          <bdi dir="ltr">
            {formatValue(latest.value, language)}
            {metric.unit ? ` ${metric.unit}` : ""}
          </bdi>
        </dd>
        <dd className="text-xs text-slate-500 dark:text-slate-400">
          {formatDate(latest.date, language)}
        </dd>
      </div>
      <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
        <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {messages.previousValue}
        </dt>
        <dd className="mt-1 font-bold text-slate-950 dark:text-white">
          {previous ? (
            <bdi dir="ltr">
              {formatValue(previous.value, language)}
              {metric.unit ? ` ${metric.unit}` : ""}
            </bdi>
          ) : (
            messages.notAvailable
          )}
        </dd>
        {previous && (
          <dd className="text-xs text-slate-500 dark:text-slate-400">
            {formatDate(previous.date, language)}
          </dd>
        )}
      </div>
      <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
        <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {messages.absoluteChange}
        </dt>
        <dd className="mt-1 font-bold text-slate-950 dark:text-white">
          {change === null ? (
            messages.notAvailable
          ) : (
            <bdi dir="ltr">
              {formatValue(change, language)}
              {metric.unit ? ` ${metric.unit}` : ""}
            </bdi>
          )}
        </dd>
        <dd className="mt-1">
          {questionnaire ? (
            <AssessmentBadge
              kind="risk"
              messages={messages}
              value={latest.riskBand}
            />
          ) : (
            <ReferenceBadge messages={messages} state={referenceState} />
          )}
        </dd>
      </div>
    </dl>
  );
};

const MetricCard = ({
  code,
  language,
  messages,
  metric,
  questionnaire = false,
  title,
}) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 dark:border-slate-800 dark:bg-slate-900">
    <div>
      <p
        className="text-xs font-bold text-teal-700 dark:text-teal-300"
        dir="ltr"
      >
        {code}
      </p>
      <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
        {title}
      </h2>
      {!questionnaire && metric.reference && (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {messages.referenceRange}:{" "}
          <bdi dir="ltr">
            {metric.reference.low ?? "—"}–{metric.reference.high ?? "—"}{" "}
            {metric.unit}
          </bdi>
        </p>
      )}
    </div>
    {metric.points.length === 0 ? (
      <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
        {messages.metricUnavailable}
      </p>
    ) : (
      <>
        <div className="mt-5">
          <MetricSummary
            language={language}
            messages={messages}
            metric={metric}
            questionnaire={questionnaire}
          />
        </div>
        <div className="mt-6" dir="ltr">
          <TimeSeriesChart
            accessibleLabel={`${title}: ${messages.timeSeriesChart}`}
            dateLabel={messages.date}
            points={metric.points}
            unit={metric.unit ?? ""}
            valueLabel={messages.value}
          />
        </div>
      </>
    )}
  </article>
);

export default async function PatientDashboardPage({ searchParams }) {
  const [{ language }, options, query] = await Promise.all([
    getRequestPreferences(),
    listPatientDashboardOptions(prisma),
    searchParams,
  ]);
  const messages = getTranslations(language);
  const { patient: selectedPatientId } = parsePatientDashboardQuery(query);
  const dashboard = selectedPatientId
    ? await getPatientDashboardData(prisma, selectedPatientId)
    : null;
  const hasAnyData = dashboard
    ? Object.values(dashboard.metrics).some(
        (metric) => metric.points.length > 0,
      )
    : false;
  const isPartial = dashboard
    ? Object.values(dashboard.metrics).some(
        (metric) => metric.points.length === 0,
      ) && hasAnyData
    : false;

  return (
    <section aria-labelledby="patient-dashboard-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          description={messages.patientDashboardDescription}
          headingId="patient-dashboard-heading"
          title={messages.patientDashboardHeading}
        />
      </div>

      <form
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        method="get"
      >
        <label
          className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
          htmlFor="dashboard-patient"
        >
          {messages.selectPatient}
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <select
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            defaultValue={dashboard?.patient.id ?? ""}
            id="dashboard-patient"
            name="patient"
            required
          >
            <option disabled value="">
              {messages.chooseActivePatient}
            </option>
            {options.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.lastName}, {patient.firstName} ({patient.mrn})
              </option>
            ))}
          </select>
          <button
            className="rounded-full bg-teal-700 px-5 py-2 font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
            type="submit"
          >
            {messages.viewDashboard}
          </button>
        </div>
      </form>

      {options.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <h2 className="text-xl font-bold">
            {messages.noDashboardPatientsTitle}
          </h2>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            {messages.noDashboardPatientsDescription}
          </p>
          <Link
            className="control-pill mt-5 inline-block rounded-full bg-teal-700 px-4 py-2 font-semibold text-white"
            href="/patients"
          >
            {messages.newPatient}
          </Link>
        </div>
      ) : selectedPatientId && !dashboard ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950">
          <h2 className="font-bold">
            {messages.dashboardPatientUnavailableTitle}
          </h2>
          <p className="mt-2 text-sm">
            {messages.dashboardPatientUnavailableDescription}
          </p>
        </div>
      ) : !dashboard ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <h2 className="text-xl font-bold">
            {messages.selectPatientPromptTitle}
          </h2>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            {messages.selectPatientPromptDescription}
          </p>
        </div>
      ) : !hasAnyData ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <h2 className="text-xl font-bold">{messages.noDashboardDataTitle}</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            {messages.noDashboardDataDescription}
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <div className="rounded-2xl bg-slate-900 p-5 text-white dark:bg-slate-800">
            <p className="text-sm text-slate-300" dir="ltr">
              {dashboard.patient.mrn}
            </p>
            <h2 className="mt-1 text-2xl font-bold">
              {dashboard.patient.firstName} {dashboard.patient.lastName}
            </h2>
          </div>
          {isPartial && (
            <p
              className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100"
              role="status"
            >
              {messages.partialDashboardData}
            </p>
          )}
          <div className="mt-5 grid gap-5">
            <MetricCard
              code="GLU-F"
              language={language}
              messages={messages}
              metric={dashboard.metrics.fastingGlucose}
              title={messages.fastingGlucose}
            />
            <MetricCard
              code="HBA1C"
              language={language}
              messages={messages}
              metric={dashboard.metrics.hba1c}
              title={messages.hba1c}
            />
            {dashboard.metrics.systolicBloodPressure.points.length > 0 && (
              <MetricCard
                code="SBP"
                language={language}
                messages={messages}
                metric={dashboard.metrics.systolicBloodPressure}
                title={messages.systolicBloodPressure}
              />
            )}
            <MetricCard
              code="DSMA-8"
              language={language}
              messages={messages}
              metric={dashboard.metrics.questionnaire}
              questionnaire
              title={messages.questionnaireScore}
            />
          </div>
        </div>
      )}
    </section>
  );
}
