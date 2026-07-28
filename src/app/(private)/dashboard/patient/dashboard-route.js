import Link from "next/link";

import ChartCard from "@/components/chart-card";
import { DonutChart, HorizontalBarChart } from "@/components/dashboard-charts";
import DashboardKpi from "@/components/dashboard-kpi";
import DeferredChart from "@/components/deferred-chart";
import PageHeader from "@/components/page-header";
import PatientDashboardFilter from "@/components/patient-dashboard-filter";
import TimeSeriesChart from "@/components/time-series-chart";
import { getDocumentDirection } from "@/config/preferences";
import { getTranslations } from "@/i18n/translations";
import { parsePatientDashboardQuery } from "@/lib/patient-dashboard";
import { prisma } from "@/lib/prisma";
import {
  getPatientDashboardData,
  listPatientDashboardOptions,
} from "@/server/dashboards/patient";
import { getRequestPreferences } from "@/server/preferences/current";

export const metadata = { title: "Patient Dashboard | PulseTrack" };
export const dynamic = "force-dynamic";

const number = (value, language, options = {}) =>
  value == null
    ? null
    : new Intl.NumberFormat(language === "ar" ? "ar-LB" : "en-GB", {
        maximumFractionDigits: 1,
        ...options,
      }).format(value);

const date = (value, language) =>
  new Intl.DateTimeFormat(language === "ar" ? "ar-LB" : "en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));

const Card = ({ children, title }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
    <h2 className="text-lg font-bold text-slate-950 dark:text-white">
      {title}
    </h2>
    <div className="mt-5">{children}</div>
  </section>
);

const reasonLabel = (reason, messages) =>
  ({
    OVERDUE_ASSESSMENT: messages.overdueAssessmentReason,
    ABNORMAL_LAB: messages.abnormalLabReason,
    DELIVERY_FAILURE: messages.deliveryFailureReason,
  })[reason];

export default async function PatientDashboardPage({ searchParams }) {
  const [{ language }, options, query] = await Promise.all([
    getRequestPreferences(),
    listPatientDashboardOptions(prisma),
    searchParams,
  ]);
  const messages = getTranslations(language);
  const direction = getDocumentDirection(language);
  const { patient: selectedPatientId } = parsePatientDashboardQuery(query);
  const filterContextComplete = query !== undefined;
  const skipDashboardQuery = !filterContextComplete;
  const dashboard = skipDashboardQuery
    ? null
    : await getPatientDashboardData(prisma, selectedPatientId);

  return (
    <section aria-labelledby="patient-dashboard-heading">
      <PageHeader
        description={messages.patientDashboardDescription}
        headingId="patient-dashboard-heading"
        title={messages.patientDashboardHeading}
      />

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <PatientDashboardFilter
          direction={direction}
          messages={messages}
          options={options}
          selectedPatientId={selectedPatientId}
        />
      </div>

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
      ) : !dashboard ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950">
          <h2 className="font-bold">
            {messages.dashboardPatientUnavailableTitle}
          </h2>
          <p className="mt-2 text-sm">
            {messages.dashboardPatientUnavailableDescription}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 rounded-2xl bg-slate-900 p-5 text-white dark:bg-slate-800">
            <p className="text-sm text-slate-300">
              {dashboard.patient
                ? messages.dashboardScopePatient
                : messages.dashboardScopeAll}
            </p>
            <h2 className="mt-1 text-2xl font-bold">
              {dashboard.patient
                ? `${dashboard.patient.firstName} ${dashboard.patient.lastName}`
                : messages.allPatients}
            </h2>
            {dashboard.patient ? (
              <p className="mt-1 text-sm text-slate-300" dir="ltr">
                {dashboard.patient.mrn}
              </p>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <DashboardKpi
              label={messages.activePatients}
              value={number(dashboard.activePatientCount, language)}
            />
            <DashboardKpi
              label={messages.assessmentsTotal}
              value={number(dashboard.assessments.total, language)}
            />
            <DashboardKpi
              gaugeValue={dashboard.assessments.completionRate}
              label={messages.completionRateShort}
              value={
                dashboard.assessments.completionRate == null
                  ? messages.notAvailable
                  : `${number(dashboard.assessments.completionRate, language)}%`
              }
            />
            <DashboardKpi
              gaugeValue={dashboard.assessments.responseRate}
              label={messages.responseRate}
              value={
                dashboard.assessments.responseRate == null
                  ? messages.notAvailable
                  : `${number(dashboard.assessments.responseRate, language)}%`
              }
            />
            <DashboardKpi
              label={messages.averageScore}
              value={
                dashboard.assessments.averageScore == null
                  ? messages.notAvailable
                  : number(dashboard.assessments.averageScore, language)
              }
            />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
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
            <ChartCard title={messages.labRangeDistribution}>
              <DeferredChart loadingLabel={messages.labRangeDistribution}>
                <DonutChart
                  accessibleLabel={messages.labRangeDistribution}
                  items={[
                    {
                      label: messages.inReferenceRange,
                      value: dashboard.labs.inRange,
                    },
                    {
                      label: messages.aboveReference,
                      value: dashboard.labs.outOfRange,
                    },
                  ]}
                />
              </DeferredChart>
            </ChartCard>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
            <Card title={messages.patientsNeedingFollowUp}>
              {dashboard.followUp.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {messages.noFollowUp}
                </p>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                  {dashboard.followUp.map((item) => (
                    <li
                      className="py-3 first:pt-0 last:pb-0"
                      key={item.patient.id}
                    >
                      <Link
                        className="font-bold text-teal-700 hover:underline dark:text-teal-300"
                        href={`/patients/${item.patient.id}`}
                      >
                        {item.patient.lastName}, {item.patient.firstName}{" "}
                        <bdi dir="ltr">({item.patient.mrn})</bdi>
                      </Link>
                      <ul className="mt-1 list-disc ps-5 text-sm text-slate-600 dark:text-slate-300">
                        {item.reasons.map((reason) => (
                          <li key={reason}>{reasonLabel(reason, messages)}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title={messages.recentActivity}>
              {dashboard.recentActivity.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {messages.noRecentActivity}
                </p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {dashboard.recentActivity.map((activity, index) => (
                    <li
                      className="flex justify-between gap-4"
                      key={`${activity.date}-${index}`}
                    >
                      <span>
                        {activity.type === "LAB"
                          ? messages.labActivity
                          : messages.assessmentActivity}
                        : {activity.label}
                      </span>
                      <time
                        className="shrink-0 text-slate-500"
                        dateTime={activity.date}
                      >
                        {date(activity.date, language)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            {[
              [messages.questionnaireScore, dashboard.metrics.questionnaire],
              [messages.fastingGlucose, dashboard.metrics.fastingGlucose],
              [messages.hba1c, dashboard.metrics.hba1c],
              [
                messages.systolicBloodPressure,
                dashboard.metrics.systolicBloodPressure,
              ],
            ].map(([title, metric]) => (
              <ChartCard key={title} title={title}>
                {metric.points.length === 0 ? (
                  <p className="grid h-[18.75rem] place-items-center text-sm text-slate-600 dark:text-slate-300">
                    {messages.metricUnavailable}
                  </p>
                ) : (
                  <DeferredChart
                    loadingLabel={`${title}: ${messages.timeSeriesChart}`}
                  >
                    <div dir="ltr">
                      <TimeSeriesChart
                        accessibleLabel={`${title}: ${messages.timeSeriesChart}`}
                        dateLabel={messages.date}
                        points={metric.points}
                        unit={metric.unit ?? ""}
                        valueLabel={messages.value}
                      />
                    </div>
                  </DeferredChart>
                )}
              </ChartCard>
            ))}
          </div>

          <div className="mt-5">
            <ChartCard title={messages.patientsNeedingFollowUp}>
              <DeferredChart loadingLabel={messages.patientsNeedingFollowUp}>
                <HorizontalBarChart
                  accessibleLabel={messages.patientsNeedingFollowUp}
                  items={[
                    {
                      label: messages.overdueAssessmentReason,
                      value: dashboard.followUp.filter((item) =>
                        item.reasons.includes("OVERDUE_ASSESSMENT"),
                      ).length,
                    },
                    {
                      label: messages.abnormalLabReason,
                      value: dashboard.followUp.filter((item) =>
                        item.reasons.includes("ABNORMAL_LAB"),
                      ).length,
                    },
                    {
                      label: messages.deliveryFailureReason,
                      value: dashboard.followUp.filter((item) =>
                        item.reasons.includes("DELIVERY_FAILURE"),
                      ).length,
                    },
                  ]}
                />
              </DeferredChart>
            </ChartCard>
          </div>
        </>
      )}
    </section>
  );
}
