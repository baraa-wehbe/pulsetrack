import { lazy, Suspense } from "react";

import DashboardRouteSkeleton from "@/components/dashboard-route-skeleton";

const PatientDashboardRoute = lazy(() => import("./dashboard-route"));

export const metadata = { title: "Patient Dashboard | PulseTrack" };
export const dynamic = "force-dynamic";

export default function PatientDashboardPage({ searchParams }) {
  return (
    <Suspense fallback={<DashboardRouteSkeleton />}>
      <PatientDashboardRoute searchParams={searchParams} />
    </Suspense>
  );
}
