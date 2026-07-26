import Link from "next/link";

export default function PatientWorkflowPlaceholder({
  description,
  heading,
  messages,
  patient,
}) {
  return (
    <section aria-labelledby="patient-workflow-heading">
      <Link
        className="rounded-md text-sm font-semibold text-teal-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:text-teal-300"
        href="/patients"
      >
        {messages.backToPatients}
      </Link>
      <div className="mt-5 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">
          <bdi dir="ltr">{patient.mrn}</bdi>
        </p>
        <h1
          className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white"
          id="patient-workflow-heading"
        >
          {heading}
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">{description}</p>
        <p
          className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100"
          role="status"
        >
          {messages.workflowUnavailable}
        </p>
      </div>
    </section>
  );
}
