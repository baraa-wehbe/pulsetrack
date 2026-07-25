import { redirect } from "next/navigation";

import LoginForm from "@/components/login-form";
import { getCurrentClinician } from "@/server/auth/current-clinician";
import { safeReturnPath } from "@/server/auth/validation";

export const metadata = {
  title: "Clinician login | PulseTrack",
};

export default async function LoginPage({ searchParams }) {
  const clinician = await getCurrentClinician();

  if (clinician) {
    redirect("/");
  }

  const parameters = await searchParams;
  const nextPath = safeReturnPath(parameters?.next);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-teal-700">PulseTrack</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Clinician login
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Sign in with your clinician credentials.
        </p>
        <LoginForm nextPath={nextPath} />
      </section>
    </main>
  );
}
