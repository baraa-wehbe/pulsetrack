export default function FhirSyncLoading() {
  return (
    <div aria-live="polite" className="space-y-4" role="status">
      <div className="h-10 w-72 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
      <span className="sr-only">Loading FHIR synchronization status…</span>
    </div>
  );
}
