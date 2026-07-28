import Link from "next/link";

import { STATUS_BADGE_RADIUS_CLASS } from "@/components/badge-styles";
import ChartCard from "@/components/chart-card";
import { DonutChart, HorizontalBarChart } from "@/components/dashboard-charts";
import DeferredChart from "@/components/deferred-chart";
import PageHeader from "@/components/page-header";
import PercentageGauge from "@/components/percentage-gauge";
import { getTranslations } from "@/i18n/translations";
import {
  getClinicDashboardDefaultRange,
  parseClinicDashboardQuery,
} from "@/lib/clinic-dashboard";
import { getLabImportStatusPresentation } from "@/lib/lab-import-presentation";
import { prisma } from "@/lib/prisma";
import { requireCurrentClinician } from "@/server/auth/current-clinician";
import { getClinicDashboardData } from "@/server/dashboards/clinic";
import { getPatientDashboardData } from "@/server/dashboards/patient";
import { getRequestPreferences } from "@/server/preferences/current";

export const metadata = {
  title: "Clinic Dashboard | PulseTrack",
};

export const dynamic = "force-dynamic";

const formatInteger = (value, language) =>
  new Intl.NumberFormat(language === "ar" ? "ar-LB" : "en-GB").format(value);

const formatPercent = (value, language) =>
  new Intl.NumberFormat(language === "ar" ? "ar-LB" : "en-GB", {
    maximumFractionDigits: 1,
  }).format(value);

const formatTimestamp = (value, language) =>
  new Intl.DateTimeFormat(language === "ar" ? "ar-LB" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const MetricCard = ({ description, gaugeValue, label, value }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
      {label}
    </p>
    <div className="mt-2 flex items-center justify-between gap-3">
      <p className="text-3xl font-black text-slate-950 dark:text-white">
        <bdi dir="ltr">{value}</bdi>
      </p>
      {gaugeValue == null ? null : (
        <PercentageGauge label={label} value={gaugeValue} />
      )}
    </div>
    {description && (
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {description}
      </p>
    )}
  </article>
);

const ImportStatus = ({ messages, status }) => {
  const presentation = getLabImportStatusPresentation(status);

  return (
    <span
      className={`inline-flex border px-2.5 py-1 text-xs font-bold ${STATUS_BADGE_RADIUS_CLASS} ${presentation.className}`}
    >
      {messages[presentation.translationKey]}
    </span>
  );
};

export default async function ClinicDashboardPage({ searchParams }) {
  const [clinician, { language }, query] = await Promise.all([
    requireCurrentClinician(),
    getRequestPreferences(),
    searchParams,
  ]);
  const messages = getTranslations(language);
  const parsedRange = parseClinicDashboardQuery(query);
  const range = parsedRange.success
    ? parsedRange.data
    : getClinicDashboardDefaultRange();
  const skipDashboardQuery = !parsedRange.success;
  const [dashboard, patientAnalytics] = skipDashboardQuery
    ? [null, null]
    : await Promise.all([
        getClinicDashboardData(prisma, clinician.id, range),
        getPatientDashboardData(prisma),
      ]);
  const hasRangeActivity =
    dashboard &&
    (Object.values(dashboard.assessments.counts).some((count) => count > 0) ||
      dashboard.labQuality.importCount > 0 ||
      dashboard.riskPatientCount > 0);
  const dateError = {
    INVALID_DATE: messages.dashboardDateInvalid,
    INVALID_ORDER: messages.dashboardDateOrderInvalid,
    RANGE_TOO_LARGE: messages.dashboardDateRangeTooLarge,
  }[parsedRange.error];

  return (
    <section aria-labelledby="clinic-dashboard-heading">
      <PageHeader
        description={messages.clinicDashboardDescription}
        descriptionClassName="max-w-3xl"
        headingId="clinic-dashboard-heading"
        title={messages.clinicDashboardHeading}
      />

      <form
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        method="get"
      >
        <fieldset>
          <legend className="font-bold text-slate-950 dark:text-white">
            {messages.dashboardDateRange}
          </legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-sm font-semibold">
              {messages.startDate}
              <input
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                defaultValue={range.start}
                name="start"
                required
                type="date"
              />
            </label>
            <label className="text-sm font-semibold">
              {messages.endDate}
              <input
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                defaultValue={range.end}
                name="end"
                required
                type="date"
              />
            </label>
            <button
              className="rounded-full bg-teal-700 px-5 py-2 font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
              type="submit"
            >
              {messages.applyDateRange}
            </button>
          </div>
        </fieldset>
      </form>

      {!parsedRange.success ? (
        <div
          className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
          role="alert"
        >
          <h2 className="font-bold">{messages.dashboardDateErrorTitle}</h2>
          <p className="mt-2 text-sm">{dateError}</p>
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">
            {messages.dashboardRangeSummary}{" "}
            <bdi dir="ltr">
              {dashboard.range.start} – {dashboard.range.end}
            </bdi>
          </p>

          <section aria-labelledby="clinic-overview-heading" className="mt-4">
            <h2
              className="text-xl font-bold text-slate-950 dark:text-white"
              id="clinic-overview-heading"
            >
              {messages.clinicOverview}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                description={messages.activePatientsLifetime}
                label={messages.activePatients}
                value={formatInteger(
                  dashboard.lifetime.activePatientCount,
                  language,
                )}
              />
              {[
                ["SENT", messages.assessmentSent],
                ["COMPLETED", messages.assessmentCompleted],
                ["FAILED", messages.assessmentFailed],
                ["SCHEDULED", messages.assessmentScheduled],
                ["EXPIRED", messages.assessmentExpired],
              ].map(([status, label]) => (
                <MetricCard
                  key={status}
                  label={label}
                  value={formatInteger(
                    dashboard.assessments.counts[status],
                    language,
                  )}
                />
              ))}
            </div>
          </section>

          {!hasRangeActivity && (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-7 text-center dark:border-slate-700">
              <h2 className="text-xl font-bold">
                {messages.noClinicActivityTitle}
              </h2>
              <p className="mt-2 text-slate-600 dark:text-slate-300">
                {messages.noClinicActivityDescription}
              </p>
            </div>
          )}

          <section
            aria-labelledby="assessment-quality-heading"
            className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <h2
              className="text-xl font-bold text-slate-950 dark:text-white"
              id="assessment-quality-heading"
            >
              {messages.assessmentQuality}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <MetricCard
                description={`${messages.completionRateDefinition} ${formatInteger(
                  dashboard.assessments.completionNumerator,
                  language,
                )}/${formatInteger(
                  dashboard.assessments.completionDenominator,
                  language,
                )}`}
                gaugeValue={dashboard.assessments.completionRate}
                label={messages.assessmentCompletionRate}
                value={`${formatPercent(
                  dashboard.assessments.completionRate,
                  language,
                )}%`}
              />
              <MetricCard
                description={messages.failedDeliveryRateDefinition}
                gaugeValue={dashboard.assessments.failedDeliveryRate}
                label={messages.failedDeliveryRate}
                value={`${formatPercent(
                  dashboard.assessments.failedDeliveryRate,
                  language,
                )}%`}
              />
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <ChartCard title={messages.assessmentStatusDistribution}>
                <DeferredChart
                  loadingLabel={messages.assessmentStatusDistribution}
                >
                  <DonutChart
                    accessibleLabel={messages.assessmentStatusDistribution}
                    items={[
                      {
                        label: messages.assessmentScheduled,
                        value: dashboard.assessments.counts.SCHEDULED,
                      },
                      {
                        label: messages.assessmentSent,
                        value: dashboard.assessments.counts.SENT,
                      },
                      {
                        label: messages.assessmentCompleted,
                        value: dashboard.assessments.counts.COMPLETED,
                      },
                      {
                        label: messages.assessmentExpired,
                        value: dashboard.assessments.counts.EXPIRED,
                      },
                      {
                        label: messages.assessmentFailed,
                        value: dashboard.assessments.counts.FAILED,
                      },
                    ]}
                  />
                </DeferredChart>
              </ChartCard>
              <ChartCard title={messages.labImportQuality}>
                <DeferredChart loadingLabel={messages.labImportQuality}>
                  <HorizontalBarChart
                    accessibleLabel={messages.labImportQuality}
                    items={[
                      {
                        label: messages.accepted,
                        value: dashboard.labQuality.acceptedRows,
                      },
                      {
                        label: messages.rejected,
                        value: dashboard.labQuality.rejectedRows,
                      },
                      {
                        label: messages.duplicates,
                        value: dashboard.labQuality.duplicateRows,
                      },
                    ]}
                  />
                </DeferredChart>
              </ChartCard>
              <ChartCard title={messages.labRangeDistribution}>
                <DeferredChart loadingLabel={messages.labRangeDistribution}>
                  <DonutChart
                    accessibleLabel={messages.labRangeDistribution}
                    items={[
                      {
                        label: messages.inReferenceRange,
                        value: patientAnalytics.labs.inRange,
                      },
                      {
                        label: messages.aboveReference,
                        value: patientAnalytics.labs.outOfRange,
                      },
                    ]}
                  />
                </DeferredChart>
              </ChartCard>
            </div>
          </section>

          <section
            aria-labelledby="clinic-follow-up-heading"
            className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <h2
              className="text-xl font-bold text-slate-950 dark:text-white"
              id="clinic-follow-up-heading"
            >
              {messages.patientsNeedingFollowUp}
            </h2>
            {patientAnalytics.followUp.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                {messages.noFollowUp}
              </p>
            ) : (
              <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
                <ChartCard title={messages.patientsNeedingFollowUp}>
                  <DeferredChart
                    loadingLabel={messages.patientsNeedingFollowUp}
                  >
                    <HorizontalBarChart
                      accessibleLabel={messages.patientsNeedingFollowUp}
                      items={[
                        {
                          label: messages.overdueAssessmentReason,
                          value: patientAnalytics.followUp.filter((item) =>
                            item.reasons.includes("OVERDUE_ASSESSMENT"),
                          ).length,
                        },
                        {
                          label: messages.abnormalLabReason,
                          value: patientAnalytics.followUp.filter((item) =>
                            item.reasons.includes("ABNORMAL_LAB"),
                          ).length,
                        },
                        {
                          label: messages.deliveryFailureReason,
                          value: patientAnalytics.followUp.filter((item) =>
                            item.reasons.includes("DELIVERY_FAILURE"),
                          ).length,
                        },
                      ]}
                    />
                  </DeferredChart>
                </ChartCard>
                <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                  {patientAnalytics.followUp.slice(0, 8).map((item) => (
                    <li className="py-2 first:pt-0" key={item.patient.id}>
                      <Link
                        className="font-bold text-teal-700 hover:underline dark:text-teal-300"
                        href={`/patients/${item.patient.id}`}
                      >
                        {item.patient.lastName}, {item.patient.firstName}{" "}
                        <bdi dir="ltr">({item.patient.mrn})</bdi>
                      </Link>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {item.reasons
                          .map(
                            (reason) =>
                              ({
                                OVERDUE_ASSESSMENT:
                                  messages.overdueAssessmentReason,
                                ABNORMAL_LAB: messages.abnormalLabReason,
                                DELIVERY_FAILURE:
                                  messages.deliveryFailureReason,
                              })[reason],
                          )
                          .join(" · ")}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section
            aria-labelledby="risk-distribution-heading"
            className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <h2
              className="text-xl font-bold text-slate-950 dark:text-white"
              id="risk-distribution-heading"
            >
              {messages.latestRiskDistribution}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {messages.latestRiskDistributionDescription}
            </p>
            {dashboard.riskPatientCount === 0 ? (
              <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-5 text-sm dark:border-slate-700">
                {messages.noRiskData}
              </p>
            ) : (
              <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["LOW", messages.riskLow],
                  ["MODERATE", messages.riskModerate],
                  ["HIGH", messages.riskHigh],
                  ["VERY_HIGH", messages.riskVeryHigh],
                ].map(([risk, label]) => (
                  <div
                    className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70"
                    key={risk}
                  >
                    <dt className="text-sm font-semibold">{label}</dt>
                    <dd className="mt-2 text-3xl font-black">
                      {formatInteger(
                        dashboard.riskDistribution[risk],
                        language,
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section
            aria-labelledby="lab-quality-heading"
            className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <h2
              className="text-xl font-bold text-slate-950 dark:text-white"
              id="lab-quality-heading"
            >
              {messages.labImportQuality}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {messages.clinicianUploadScope}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label={messages.labRejectedRows}
                value={formatInteger(
                  dashboard.labQuality.rejectedRows,
                  language,
                )}
              />
              <MetricCard
                label={messages.labDuplicateRows}
                value={formatInteger(
                  dashboard.labQuality.duplicateRows,
                  language,
                )}
              />
              <MetricCard
                label={messages.importsWithFailures}
                value={formatInteger(
                  dashboard.labQuality.importsWithFailures,
                  language,
                )}
              />
              <MetricCard
                label={messages.totalImportedRows}
                value={formatInteger(dashboard.labQuality.totalRows, language)}
              />
            </div>
          </section>

          <section
            aria-labelledby="recent-uploads-heading"
            className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <h2
              className="text-xl font-bold text-slate-950 dark:text-white"
              id="recent-uploads-heading"
            >
              {messages.recentLabUploads}
            </h2>
            {dashboard.recentImports.length === 0 ? (
              <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-5 text-sm dark:border-slate-700">
                {messages.noRecentLabUploads}
              </p>
            ) : (
              <ul className="mt-5 space-y-3">
                {dashboard.recentImports.map((labImport) => (
                  <li
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700"
                    key={labImport.id}
                  >
                    <div className="min-w-0">
                      <Link
                        className="break-all font-bold text-teal-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:text-teal-300"
                        href={`/lab-uploads/${labImport.id}`}
                      >
                        {labImport.originalFileName}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {formatTimestamp(labImport.createdAt, language)}
                      </p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        {messages.accepted}: {labImport.acceptedRows} ·{" "}
                        {messages.rejected}: {labImport.rejectedRows} ·{" "}
                        {messages.duplicates}: {labImport.duplicateRows}
                      </p>
                    </div>
                    <ImportStatus
                      messages={messages}
                      status={labImport.status}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  );
}
