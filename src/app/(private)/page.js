import LogoutButton from "@/components/logout-button";
import { requireCurrentClinician } from "@/server/auth/current-clinician";

export default async function Home() {
  const clinician = await requireCurrentClinician();

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-teal-700">PulseTrack</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Welcome, {clinician.fullName}
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          Clinician authentication is active.
        </p>
        <div className="mt-8">
          <LogoutButton />
        </div>
      </section>
    </main>
  );
}
